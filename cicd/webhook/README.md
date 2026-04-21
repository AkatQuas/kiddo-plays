# Webhook Study Memo

Trial notes for [adnanh/webhook](https://github.com/adnanh/webhook).

Two sample webhook definitions provided in [webhook/hooks.yaml](./webhook/hooks.yaml).

## Setup Note

Working directory configuration can be tricky. The Docker image `lwlook/webhook` does **not** create target directories automatically; ensure paths exist before mounting.

## Run with Docker

Start the service using Docker Compose:

```bash
docker compose up
```

Local [config](./webhook) and [scripts](./scripts/) directories are mounted into the container for live updates.

## Test Invocation

Trigger the webhook with a `POST` request:

```bash
curl --request POST \
  --url http://localhost:9000/hooks/webhook_job1 \
  --header 'content-type: application/json' \
  --data '{ "arg": "1" }'
```

## Pros

- Extremely lightweight: compiled Go binary, no external runtime required
- Fast startup and low resource footprint
- Clean, declarative YAML configuration with hot-reload support
- Flexible triggering: IP whitelisting, HMAC verification, and more
- General-purpose: can execute arbitrary shell scripts or binaries
- Stable and mature with minimal operational overhead

### Best For

Small-scale automation tasks such as deployment hooks, lightweight CI triggers, and simple event-driven jobs on resource-constrained environments.

## Cons

- Limited recent maintainer activity
- Stateless fire-and-forget design: no built-in job queuing or retries
- Minimal observability: only basic logging, no metrics or alerting
- Limited concurrency and scaling capabilities
- Security hardening (HTTPS, proper HMAC/IP rules) requires manual configuration
- No native workflow orchestration or dependency chaining

### Avoid When

Your use case requires reliable job retries, complex multi-step workflows, enterprise-grade observability, high concurrency, or managed fault tolerance.
