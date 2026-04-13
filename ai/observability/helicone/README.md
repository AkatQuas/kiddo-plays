# Helicone — AI Gateway & LLM Observability

[Helicone](https://helicone.ai) is an AI Gateway + observability platform designed for AI engineers.

## Features

- **Proxy Gateway** — Route LLM requests through Helicone to capture all traffic
- **Built-in Observability** — Automatic request logging, latency tracking, cost analysis
- **Custom Providers** — Map to any LLM endpoint via headers
- **Self-Hosted** — Full control over your data

## Self-Hosted Deployment

### One-Line Docker

```bash
# Replace YOUR_IP with your server's public IP or domain
export YOUR_IP="10.1.100.200"
export PUBLIC_URL="http://$YOUR_IP:3000"
export JAWN_URL="http://$YOUR_IP:8585"
export S3_URL="http://$YOUR_IP:9080"

docker run -d \
  --name helicone \
  -p 3000:3000 \
  -p 8585:8585 \
  -p 9080:9080 \
  -e SITE_URL="$PUBLIC_URL" \
  -e BETTER_AUTH_URL="$PUBLIC_URL" \
  -e BETTER_AUTH_SECRET="$(openssl rand -base64 32)" \
  -e NEXT_PUBLIC_APP_URL="$PUBLIC_URL" \
  -e NEXT_PUBLIC_HELICONE_JAWN_SERVICE="$JAWN_URL" \
  -e NEXT_PUBLIC_IS_ON_PREM=true \
  -e S3_ENDPOINT="$S3_URL" \
  helicone/helicone-all-in-one:latest
```

> **Note:** Using image tag `v2025.08.21`. Newer versions may have additional features.

### Custom LLM Providers

Route to any LLM provider using the `Helicone-Target-Url` header:

```ts
const openai = new OpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: 'http://localhost:8585/v1/gateway/oai/v1',
  defaultHeaders: {
    'Helicone-Target-Url': 'https://custom-llm-provider.com'
  }
});
```

See full example: [openai_to_anthropic](https://github.com/Helicone/helicone/blob/main/examples/openai_to_anthropic/index.ts).

## Manual Deployment

For more control, use `docker compose`:

```bash
# Clone and follow README.md in docker/ folder
git clone https://github.com/Helicone/helicone.git
cd helicone/docker
```

## Limitations (Self-Hosted)

- ❌ Registration/signup may not work on self-hosted instances
- ❌ Some cloud-only features unavailable (analytics dashboards, team features)
- ⚠️ Older image versions may have bugs — test thoroughly

## When to Use Helicone

- You need a lightweight gateway for multiple LLM providers
- You wantRequest logging without additional instrumentation
- You prefer simple Docker deployment over full platform setup

## ❌ Self-Hosted Issues

**Failed to start locally.** Documenting for future reference:

- Docker all-in-one image may fail to initialize properly
- Registration/signup flow requires cloud backend
- Using older image tag `v2025.08.21` — newer versions may work better

> _"I cannot test the trace with docker mode. Besides, official helicone is not open for registration. Sad."_

### Attempted Fixes

1. Tried `docker compose` deployment — also failed
2. Tried manual configuration — gave up

If you get it working, please update this memo!
