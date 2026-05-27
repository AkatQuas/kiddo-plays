# Turborepo Tailwind CSS start

This example shows a Turborepo monorepo with a local [OpenTelemetry Collector](https://opentelemetry.io/docs/collector/), [Prometheus](https://prometheus.io/), and [Grafana](https://grafana.com/) for visualizing Turborepo's OTEL metrics.

## What's inside?

This Turborepo includes the following packages/apps:

### Apps and Packages

- `docs`: a [Next.js](https://nextjs.org/) app with [Tailwind CSS](https://tailwindcss.com/)
- `web`: another [Next.js](https://nextjs.org/) app with [Tailwind CSS](https://tailwindcss.com/)
- `ui`: a stub React component library with [Tailwind CSS](https://tailwindcss.com/) shared by both `web` and `docs` applications
- `@repo/eslint-config`: `eslint` configurations (includes `eslint-config-next` and `eslint-config-prettier`)
- `@repo/typescript-config`: `tsconfig.json`s used throughout the monorepo

Each package/app is 100% [TypeScript](https://www.typescriptlang.org/).

### Building packages/ui

This example is set up to produce compiled styles for `ui` components into the `dist` directory. The component `.tsx` files are consumed by the Next.js apps directly using `transpilePackages` in `next.config.ts`. This was chosen for several reasons:

- Make sharing one `tailwind.config.ts` to apps and packages as easy as possible.
- Make package compilation simple by only depending on the Next.js Compiler and `tailwindcss`.
- Ensure Tailwind classes do not overwrite each other. The `ui` package uses a `ui-` prefix for it's classes.
- Maintain clear package export boundaries.

Another option is to consume `packages/ui` directly from source without building. If using this option, you will need to update the `tailwind.config.ts` in your apps to be aware of your package locations, so it can find all usages of the `tailwindcss` class names for CSS compilation.

For example, in [tailwind.config.ts](packages/tailwind-config/tailwind.config.ts):

```js
  content: [
    // app content
    `src/**/*.{js,ts,jsx,tsx}`,
    // include packages if not transpiling
    "../../packages/ui/*.{js,ts,jsx,tsx}",
  ],
```

If you choose this strategy, you can remove the `tailwindcss` and `autoprefixer` dependencies from the `ui` package.

## OTEL Collector Stack

The included [`docker-compose.yml`](./docker/docker-compose.yml) starts:

- **`otel-collector`** -- OTLP gRPC receiver with a debug exporter and Prometheus exporter
- **`prometheus`** -- scrapes metrics from the collector
- **`grafana`** -- pre-configured with a Turborepo dashboard (anonymous access enabled)

| Service             | Port |
| ------------------- | ---- |
| OTLP gRPC           | 4317 |
| Collector metrics   | 8888 |
| Prometheus exporter | 8889 |
| Prometheus UI       | 9090 |
| Grafana UI          | 3001 |

### 1. Start the collector stack

```sh
docker compose up -d
```

Confirm it's ready:

```sh
docker compose logs otel-collector
# Look for: "Everything is ready. Begin running and processing data."
```

### 2. Configure Turborepo OTEL with flag and environment variables

Enable the [`futureFlags#experimentalObservability`](./turbo.json) flag to be true.

**macOS / Linux:**

```sh
export TURBO_EXPERIMENTAL_OTEL_ENABLED=1
export TURBO_EXPERIMENTAL_OTEL_ENDPOINT=https://localhost:4317
export TURBO_EXPERIMENTAL_OTEL_RESOURCE="service.name=turborepo,env=local"
export TURBO_EXPERIMENTAL_OTEL_METRICS_TASK_DETAILS=1
```

**Windows (PowerShell):**

```powershell
$env:TURBO_EXPERIMENTAL_OTEL_ENABLED=1
$env:TURBO_EXPERIMENTAL_OTEL_ENDPOINT="https://localhost:4317"
$env:TURBO_EXPERIMENTAL_OTEL_RESOURCE="service.name=turborepo,env=local"
$env:TURBO_EXPERIMENTAL_OTEL_METRICS_TASK_DETAILS=1
```

### 3. Run a task

```sh
turbo build
```

### 4. Verify metrics

**Collector logs (debug exporter)**:

```sh
docker compose logs --tail=100 otel-collector
```

You should see entries like:

```text
Metrics {"otelcol.component.id": "debug", "otelcol.signal": "metrics", "resource metrics": 1, "metrics": 4, "data points": 4}
Resource attributes:
     -> env: Str(local)
     -> service.name: Str(turborepo)
Metric #0
     -> Name: turbo.run.duration_ms
Metric #1
     -> Name: turbo.run.tasks.attempted
Metric #2
     -> Name: turbo.run.tasks.failed
Metric #3
     -> Name: turbo.run.tasks.cached
```

**Prometheus UI**: Click any of these links to open pre-filled queries:

- [All run metrics](http://localhost:9090/graph?g0.expr=%7B__name__%3D~%22turbo_run_.%2B%22%7D&g0.tab=0) -- `{__name__=~"turbo_run_.+"}`
- [Run duration (histogram)](http://localhost:9090/graph?g0.expr=turbo_run_duration_ms_sum+%2F+turbo_run_duration_ms_count&g0.tab=0) -- avg duration per run
- [Tasks attempted](http://localhost:9090/graph?g0.expr=turbo_run_tasks_attempted_total&g0.tab=0)
- [Tasks cached](http://localhost:9090/graph?g0.expr=turbo_run_tasks_cached_total&g0.tab=0)
- [Tasks failed](http://localhost:9090/graph?g0.expr=turbo_run_tasks_failed_total&g0.tab=0)
- [Cache hit rate](<http://localhost:9090/graph?g0.expr=turbo_run_tasks_cached_total+%2F+clamp_min(turbo_run_tasks_attempted_total%2C+1)&g0.tab=0>)

**Grafana dashboard**: Open `http://localhost:3001` -- the **Turborepo Runs** dashboard is pre-configured and loads automatically. No login required. The dashboard includes:

- Run duration (avg and p95) and runs over time
- Tasks attempted, cached, failed, and cache hit rate
- **Task breakdown** -- duration by task (build, lint, check-types, etc.), cache status by task, a detail table with package names, and time-series charts for tracking changes across runs

### 5. Cleanup

```sh
docker compose down
```

## Utilities

This Turborepo has some additional tools already setup for you:

- [Tailwind CSS](https://tailwindcss.com/) for styles
- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting
