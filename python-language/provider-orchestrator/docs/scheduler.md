# Scheduler

`Dispatcher` encodes a reusable multi-provider scheduling pattern.

## Layers inside one dispatch

1. **Cache** — identical requests short-circuit (TTL via `CachePort`).
2. **Live providers** — walk `platform_order`; for each platform pick a key
   with remaining hour/month quota; call the adapter.
3. **Fallback** — when live paths exhaust or return empty, invoke a secondary
   adapter (vector index, static catalog, alternate vendor, …).

## Why this split

- Quota and caching policy stay independent of product semantics.
- Adding a vendor = new `ProductAdapter` + keys in the registry.
- Ops can read `attempts` to see cache hits, missing keys, and fallback use.
