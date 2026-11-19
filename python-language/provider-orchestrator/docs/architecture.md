# Architecture

Provider Orchestrator is organized as **ports + layers**. Product features are
adapters at the edge; the durable value is scheduling, credential pools, and
management shape.

```
┌──────────────────────────────────────────────────────────────┐
│ Product Adapters (replaceable)                               │
│   EchoAdapter / your official SDK / internal HTTP client     │
├──────────────────────────────────────────────────────────────┤
│ Scheduler                                                     │
│   cache → ordered platforms → KeyRegistry.pick → fallback    │
├──────────────────────────────────────────────────────────────┤
│ Credential management                                         │
│   KeyRegistry (RR + quota)   TokenPool (QPS + circuit)       │
│   SessionBroker (account → opaque credential → upstream)     │
├──────────────────────────────────────────────────────────────┤
│ Transport patterns                                            │
│   WorkerPool health   ProxyPool sticky bind (learning only)  │
├──────────────────────────────────────────────────────────────┤
│ Ports                                                         │
│   ProductAdapter   CachePort   KeyStorePort                  │
└──────────────────────────────────────────────────────────────┘
```

## Design rules

1. **Ports first** — orchestrator code imports interfaces, not vendor SDKs.
2. **Secrets outside code** — keys and proxy URLs come from environment /
   secret stores (see `.env.example`).
3. **Products are swappable** — image search, vector recall, or any domain API
   can sit behind `ProductAdapter` without touching pool/scheduler code.
4. **No site scrapers** — this project does not ship crawlers, browser stealth
   stacks, or reverse-engineered private app protocols.
5. **Management is first-class** — quota snapshots, pool stats, and session
   public views are part of the architecture, not afterthoughts.

## Typical request path

1. Build a `ProductRequest`.
2. `Dispatcher.dispatch` checks `CachePort`.
3. For each platform in order, `KeyRegistry.pick` returns a quota-available key.
4. `ProductAdapter.execute(request, credential)` runs.
5. On empty/exhausted providers, optional fallback adapter runs.
6. Management API can inspect attempts, quotas, and pool stats.
