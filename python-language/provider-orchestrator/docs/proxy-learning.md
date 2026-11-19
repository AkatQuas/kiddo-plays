# Proxy patterns (learning only)

## Disclaimer

Residential and datacenter proxies are a **networking technique** discussed
here for architecture study (egress diversity, sticky sessions, health
screening).  

**This module is not a commercial feature.** Do not use it to:

- bypass access controls
- violate third-party terms of service
- anonymize production commerce traffic without legal review

Enable related demos only with `LEARNING_PROXY_ENABLED=true` and your own
URLs in `LEARNING_PROXY_URLS`. Example code uses fake `*.example` hosts and
does not perform network I/O by default.

## Patterns illustrated

1. **Sticky bind** — worker index N prefers proxy N (modulo pool size).
2. **Failure accounting** — consecutive failures mark an endpoint dead.
3. **Health screen hook** — caller supplies a benign check function; the
   library does not embed target-site probes.
4. **WorkerPool composition** — transport workers carry an optional proxy URL
   and expose healthy/unhealthy state for schedulers.
