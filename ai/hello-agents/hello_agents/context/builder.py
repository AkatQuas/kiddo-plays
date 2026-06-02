"""ContextBuilder - GSSC Pipeline Implementation

Implements the Gather-Select-Structure-Compress context building flow:
1. Gather: Collect candidate information from multiple sources (history, memory, RAG, tool results)
2. Select: Filter based on priority, relevance, and diversity
3. Structure: Organize into a structured context template
4. Compress: Compress and normalize within token budget
"""

import math
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import tiktoken

from ..core.message import Message
from ..tools.builtin.memory_tool import MemoryTool
from ..tools.builtin.rag_tool import RAGTool


@dataclass
class ContextPacket:
    """Context information packet"""
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)
    token_count: int = 0
    relevance_score: float = 0.0  # 0.0-1.0

    def __post_init__(self):
        """Automatically calculate token count"""
        if self.token_count == 0:
            self.token_count = count_tokens(self.content)


@dataclass
class ContextConfig:
    """Context building configuration"""
    max_tokens: int = 8000  # Total budget
    reserve_ratio: float = 0.15  # Generation buffer (10-20%)
    min_relevance: float = 0.3  # Minimum relevance threshold
    enable_mmr: bool = True  # Enable Maximal Marginal Relevance (diversity)
    mmr_lambda: float = 0.7  # MMR balance (0=pure diversity, 1=pure relevance)
    system_prompt_template: str = ""  # System prompt template
    enable_compression: bool = True  # Enable compression

    def get_available_tokens(self) -> int:
        """Get available token budget (after buffer)"""
        return int(self.max_tokens * (1 - self.reserve_ratio))


class ContextBuilder:
    """Context Builder - GSSC Pipeline

    Usage Example:
    ```python
    builder = ContextBuilder(
        memory_tool=memory_tool,
        rag_tool=rag_tool,
        config=ContextConfig(max_tokens=8000)
    )

    context = builder.build(
        user_query="User question",
        conversation_history=[...],
        system_instructions="System instructions"
    )
    ```
    """

    def __init__(
        self,
        memory_tool: Optional[MemoryTool] = None,
        rag_tool: Optional[RAGTool] = None,
        config: Optional[ContextConfig] = None
    ):
        self.memory_tool = memory_tool
        self.rag_tool = rag_tool
        self.config = config or ContextConfig()
        self._encoding = tiktoken.get_encoding("cl100k_base")

    def build(
        self,
        user_query: str,
        conversation_history: Optional[List[Message]] = None,
        system_instructions: Optional[str] = None,
        additional_packets: Optional[List[ContextPacket]] = None
    ) -> str:
        """Build complete context

        Args:
            user_query: User query
            conversation_history: Conversation history
            system_instructions: System instructions
            additional_packets: Extra context packets

        Returns:
            Structured context string
        """
        # 1. Gather: Collect candidate information
        packets = self._gather(
            user_query=user_query,
            conversation_history=conversation_history or [],
            system_instructions=system_instructions,
            additional_packets=additional_packets or []
        )

        # 2. Select: Filter and sort
        selected_packets = self._select(packets, user_query)

        # 3. Structure: Organize into structured template
        structured_context = self._structure(
            selected_packets=selected_packets,
            user_query=user_query,
            system_instructions=system_instructions
        )

        # 4. Compress: Compress and normalize (if over budget)
        final_context = self._compress(structured_context)

        return final_context

    def _gather(
        self,
        user_query: str,
        conversation_history: List[Message],
        system_instructions: Optional[str],
        additional_packets: List[ContextPacket]
    ) -> List[ContextPacket]:
        """Gather: Collect candidate information from multi-source

        Args:
            user_query: User query
            conversation_history: Conversation history
            system_instructions: System instructions
            custom_packets: Custom information packages

        Returns:
            List[ContextPacket]: Candidate information list
        """
        packets = []

        # P0: System instructions (hard constraint)
        if system_instructions:
            packets.append(ContextPacket(
                content=system_instructions,
                metadata={"type": "instructions"}
            ))

        # P1: Get task state and key conclusions from memory
        if self.memory_tool:
            try:
                # Search memory for task state
                state_results = self.memory_tool.execute(
                    "search",
                    query="(task state OR subgoal OR conclusion OR blocked)",
                    min_importance=0.7,
                    limit=5
                )
                if state_results and "no results" not in state_results.lower():
                    packets.append(ContextPacket(
                        content=state_results,
                        metadata={"type": "task_state", "importance": "high"}
                    ))

                # Search memory related to current query
                related_results = self.memory_tool.execute(
                    "search",
                    query=user_query,
                    limit=5
                )
                if related_results and "no results" not in related_results.lower():
                    packets.append(ContextPacket(
                        content=related_results,
                        metadata={"type": "related_memory"}
                    ))
            except Exception as e:
                print(f"⚠️ Memory retrieval failed: {e}")

        # P2: Get factual evidence from RAG
        if self.rag_tool:
            try:
                rag_results = self.rag_tool.run({
                    "action": "search",
                    "query": user_query,
                    "top_k": 5
                })
                if rag_results and "no results" not in rag_results.lower() and "error" not in rag_results.lower():
                    packets.append(ContextPacket(
                        content=rag_results,
                        metadata={"type": "knowledge_base"}
                    ))
            except Exception as e:
                print(f"⚠️ RAG retrieval failed: {e}")

        # P3: Conversation history (supporting material)
        if conversation_history:
            # Keep only last N messages
            recent_history = conversation_history[-10:]
            history_text = "\n".join([
                f"[{msg.role}] {msg.content}"
                for msg in recent_history
            ])
            packets.append(ContextPacket(
                content=history_text,
                metadata={"type": "history", "count": len(recent_history)}
            ))

        # Add additional packets
        packets.extend(additional_packets)

        return packets

    def _select(
        self,
        packets: List[ContextPacket],
        user_query: str
    ) -> List[ContextPacket]:
        """Select: Filter based on score and budget

        Args:
            packets: Candidate information package list
            user_query: User query (for calculating relevance)
            available_tokens: Available token count

        Returns:
            List[ContextPacket]: Selected information package list
        """
        # 1) Count words in query (how many times each word appears)
        query_counter = Counter(user_query.lower().split())

        for packet in packets:
            # 2) Count words in content
            content_counter = Counter(packet.content.lower().split())

            # 3) Calculate TOTAL matching word occurrences (not just unique matches)
            overlap = 0
            for word, count in query_counter.items():
                overlap += min(count, content_counter.get(word, 0))

            # 4) Total query words (including repeats)
            total_query_words = sum(query_counter.values())

            # 5) Score = total matching occurrences / total query words
            if total_query_words > 0:
                packet.relevance_score = overlap / total_query_words
            else:
                packet.relevance_score = 0.0

        # 2) Calculate recency (exponential decay)
        def recency_score(ts: datetime) -> float:
            delta = max((datetime.now() - ts).total_seconds(), 0)
            # "Half-life" / decay speed (3600 sec)
            tau = 3600  # 1-hour timescale, configurable
            # score = e ^ ( - time_passed / decay_speed )
            return math.exp(-delta / tau)

        # 3) Calculate composite score: 0.7*relevance + 0.3*recency
        scored_packets: List[Tuple[float, ContextPacket]] = []
        for p in packets:
            rec = recency_score(p.timestamp)
            score = 0.7 * p.relevance_score + 0.3 * rec
            scored_packets.append((score, p))

        # 4) Extract system packets (always included)
        system_packets = [p for (_, p) in scored_packets if p.metadata.get("type") == "instructions"]
        remaining = [p for (s, p) in sorted(scored_packets, key=lambda x: x[0], reverse=True)
                     if p.metadata.get("type") != "instructions"]

        # 5) Filter by min_relevance (non-system packets)
        filtered = [p for p in remaining if p.relevance_score >= self.config.min_relevance]

        # 6) Fill within budget
        available_tokens = self.config.get_available_tokens()
        selected: List[ContextPacket] = []
        used_tokens = 0

        # Add system instructions first
        for p in system_packets:
            if used_tokens + p.token_count <= available_tokens:
                selected.append(p)
                used_tokens += p.token_count

        # Add remaining by score
        for p in filtered:
            if used_tokens + p.token_count > available_tokens:
                continue
            selected.append(p)
            used_tokens += p.token_count

        return selected

    def _structure(
        self,
        selected_packets: List[ContextPacket],
        user_query: str,
        system_instructions: Optional[str]
    ) -> str:
        """Structure: Organize into structured context template

        Args:
            selected_packets: Selected information package list
            user_query: User query

        Returns:
            str: Structured context string
        """
        sections = []

        # [Role & Policies] - System instructions
        p0_packets = [p for p in selected_packets if p.metadata.get("type") == "instructions"]
        if p0_packets:
            role_section = "[Role & Policies]\n"
            role_section += "\n".join([p.content for p in p0_packets])
            sections.append(role_section)

        # [Task] - Current task
        sections.append(f"[Task]\nUser Query: {user_query}")

        # [State] - Task state
        p1_packets = [p for p in selected_packets if p.metadata.get("type") == "task_state"]
        if p1_packets:
            state_section = "[State]\nKey Progress & Open Issues:\n"
            state_section += "\n".join([p.content for p in p1_packets])
            sections.append(state_section)

        # [Evidence] - Factual evidence
        p2_packets = [
            p for p in selected_packets
            if p.metadata.get("type") in {"related_memory", "knowledge_base", "retrieval", "tool_result"}
        ]
        if p2_packets:
            evidence_section = "[Evidence]\nFacts & References:\n"
            for p in p2_packets:
                evidence_section += f"\n{p.content}\n"
            sections.append(evidence_section)

        # [Context] - Supporting material (history)
        p3_packets = [p for p in selected_packets if p.metadata.get("type") == "history"]
        if p3_packets:
            context_section = "[Context]\nConversation History & Background:\n"
            context_section += "\n".join([p.content for p in p3_packets])
            sections.append(context_section)

        # [Output] - Output constraints
        output_section = """[Output]
Please answer in the following format:
1. Conclusion (clear & concise)
2. Evidence (list supporting facts and sources)
3. Risks & Assumptions (if any)
4. Recommended Next Steps (if applicable)"""
        sections.append(output_section)

        return "\n\n".join(sections)

    def _compress(self, context: str) -> str:
        """Compress: Compress and normalize

        Args:
            context: Original context
            max_tokens: Maximum token limit

        Returns:
            str: Compressed context
        """
        if not self.config.enable_compression:
            return context

        current_tokens = count_tokens(context)
        available_tokens = self.config.get_available_tokens()

        if current_tokens <= available_tokens:
            return context

        # Simple truncation strategy (keep first N tokens)
        # In production: use LLM for high-fidelity summarization
        print(f"⚠️ Context over budget ({current_tokens} > {available_tokens}), truncating")

        # Truncate by paragraph while preserving structure
        lines = context.split("\n")
        compressed_lines = []
        used_tokens = 0

        for line in lines:
            line_tokens = count_tokens(line)
            if used_tokens + line_tokens > available_tokens:
                break
            compressed_lines.append(line)
            used_tokens += line_tokens

            if used_tokens + line_tokens <= available_tokens:
                # Fully retain
                compressed_lines.append(line)
                used_tokens += line_tokens
            else:
                # Partially retain
                remaining_tokens = available_tokens - used_tokens
                if remaining_tokens > 50:  # Retain at least 50 tokens
                    # Simple truncation (can use LLM summarization in production)
                    truncated = self._truncate_text(line, remaining_tokens)
                    compressed_lines.append(truncated + "\n[... Content compressed ...]")
                break

        compressed_context = "\n\n".join(compressed_lines)
        final_tokens = count_tokens(compressed_context)
        print(f"[ContextBuilder] Compression complete: {current_tokens} -> {final_tokens} tokens")

        return compressed_context

    def _truncate_text(self, text: str, max_tokens: int) -> str:
        """Truncate text to specified token count

        Args:
            text: Original text
            max_tokens: Maximum token count

        Returns:
            str: Truncated text
        """
        # Simple implementation: estimate by character ratio
        # Should use precise tokenizer in production
        char_per_token = len(text) / count_tokens(text) if count_tokens(text) > 0 else 4
        max_chars = int(max_tokens * char_per_token)

        return text[:max_chars]


def count_tokens(text: str) -> int:
    """Count tokens using tiktoken"""
    try:
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Fallback: rough estimate (1 token ≈ 4 chars)
        return len(text) // 4
