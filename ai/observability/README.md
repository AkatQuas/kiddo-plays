# LLM Observability & Monitoring

A self-study memo on observability tools for LLM applications.

## Overview

LLM observability involves tracking, debugging, and improving AI systems in production. Key metrics include:

- **Quality** — Output correctness and relevance
- **Cost** — Token usage and API expenses
- **Latency** — Response time performance
- **Drift** — Model behavior changes over time

## Tools Covered

| Tool                             | Type                    | Description                                                       |
| -------------------------------- | ----------------------- | ----------------------------------------------------------------- |
| [Helicone](./helicone/README.md) | Gateway + Observability | AI Gateway with built-in LLM monitoring                           |
| [Agenta](./agenta/README.md)     | LLMOps Platform         | Complete platform with playground, prompt management, and tracing |

See also: [LLM Observability Tools for Node](./LLM_Observability_Tools_for_Node.md) — quick comparison.

## Resources

- [LLM observability tools: Monitoring, debugging, and improving AI systems](https://medium.com/online-inference/llm-observability-tools-monitoring-debugging-and-improving-ai-systems-5af769796266) — soft sell for W&B Weave
- [What is LLM monitoring?](https://www.braintrust.dev/articles/what-is-llm-monitoring) — soft sell for Braintrust
- [What is observability?](https://ibm.com/think/topics/observability) — IBM topics

## Key Concepts

### Tracing

Distributed tracing tracks requests through each stage of an LLM pipeline:

- **Spans** — Individual operations (LLM call, tool execution, embedding)
- **Span Kinds** — Categorization: `agent`, `chain`, `workflow`, `tool`, `embedding`, `query`, `completion`, `chat`, `rerank`

### Why Self-Host?

- Data privacy (keep traces internal)
- Cost control (avoid per-seat pricing)
- Customization (add custom providers)
