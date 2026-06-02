# Hello Agents

[From fundamental theory to practical applications, comprehensively master the design and implementation of agent systems](https://datawhalechina.github.io/hello-agents/#/en/)

Code under [hello_agents](./hello_agents/) are toy code for tutorial. Never use them for production.

```
[Agent] (With Long-Term Memory)
  ↓ Retrieve relevant long-term memories
[Context Builder] (Run GSSC Pipeline)
  ├─ Gather: System instructions + User input + Short-term conversation history
  │           + Long-term memory results + RAG evidence
  ├─ Select: Score by relevance / recency; greedy selection within token budget
  ├─ Structure: Organize into Role / Task / Evidence / Context sections
  └─ Compress: Summarize or truncate if over token limit
  ↓ Output final structured prompt
[LLM] → Generate response → [Agent] → Update long-term memory
```
