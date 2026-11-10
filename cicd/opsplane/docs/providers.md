# Build providers

Opsplane treats builds as pluggable **providers**. A task step names a `provider` id; the engine calls `execute` (and optionally `inspect` for resume/retry).

## Built-in

| id | Purpose | Config |
|----|---------|--------|
| `mock` | Deterministic local/demo builds | always on |
| `jenkins` | Trigger/poll a Jenkins job | `JENKINS_BASE`, `JENKINS_USERNAME`, `JENKINS_API_TOKEN` |
| `docker` | `docker build` / optional push | `DOCKER_HOST`, `DOCKER_REGISTRY`, `DOCKER_USERNAME`, `DOCKER_PASSWORD` |

Any other CI (GitHub Actions, GitLab CI, Tekton, custom HTTP) can be added by implementing `BuildProvider` and calling `registry.register(provider)`.

## Contract

```ts
interface BuildProvider {
  id: string;
  title: string;
  description: string;
  execute(step, ctx): Promise<StepResult>;
  inspect?(ref, ctx): Promise<UpstreamState>;
}
```

`StepResult.status`:

- `succeeded` / `failed` — terminal for that attempt
- `running` — kicked upstream; keep `upstream_ref` for later inspect
- `unconfirmed` — query/trigger ambiguous; **do not** auto-retry

## Example task

```http
POST /tasks
Content-Type: application/json

{
  "type": "build",
  "env": "dev",
  "target": "example-api",
  "idempotency_key": "demo-1",
  "steps": [
    { "name": "image", "provider": "docker", "detail": { "tag": "example-api:dev", "context": "." } },
    { "name": "pack", "provider": "jenkins", "detail": { "job": "example-api" } }
  ]
}
```
