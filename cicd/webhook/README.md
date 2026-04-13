# Webhook

The trial on [adnanh/webhook](https://github.com/adnanh/webhook).

Two example webhooks at [webhook/hooks.yaml](./webhook/hooks.yaml).

Tricky to setup the working directory, the docker `lwlook/webhook` doesn't create such folder automatically.

Start the webhook in docker `docker compose up`. Mounting local [config](./webhook) and [scripts](./scripts/) to docker.

Invoke the webhook by:

```bash
curl --request POST \
  --url http://localhost:9000/hooks/webhook_job1 \
  --header 'content-type: application/json' \
  --data '{ "arg": "1" }'
```

## Pros

Lightweight (Go binary, no runtime), fast startup
Simple YAML config, hot-reload support
Rich trigger rules (IP whitelist, HMAC)
Flexible (runs any shell script/binary)
Mature, low resource usage

### Best For

Small-scale automation (deploy hooks, CI triggers) on low-resource environments.

## Cons

Low maintainer activity
No retries/queueing (fire-and-forget)
Minimal observability (basic logs only)
Limited scaling/concurrency
Security (IP/HMAC/HTTPS) requires manual setup
No workflow orchestration

### Avoid When

Need critical job retries, complex workflows, or enterprise-scale observability.
