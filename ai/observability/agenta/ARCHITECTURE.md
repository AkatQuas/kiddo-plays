# Agenta LLMOps Platform - Architecture Overview

## 1. High-Level Architecture

Agenta is a **full-stack monorepo** with three main components:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AGENTA PLATFORM                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │     WEB      │     │     API      │     │     SDK      │             │
│  │  (Next.js)   │  ↔  │  (FastAPI)   │  ↔  │  (Python)    │             │
│  │   Port 3000  │     │   Port 8000  │     │   pip install│             │
│  └──────────────┘     └──────────────┘     └──────────────┘             │
│         ↓                    ↓                    ↓                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │   Services   │     │  PostgreSQL  │     │    LLM       │             │
│  │  (Workers)   │     │   + Redis    │     │   Providers  │             │
│  └──────────────┘     └──────────────┘     └──────────────┘             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. Repository Structure

```
agenta/
├── api/               # Python FastAPI backend
│   ├── oss/          # Open Source (baseline)
│   ├── ee/           # Enterprise Edition extensions
│   ├── entrypoints/  # App composition root
│   └── pyproject.toml
│
├── web/              # Next.js frontend (monorepo)
│   ├── oss/          # Open Source frontend
│   ├── ee/           # Enterprise Edition frontend
│   ├── packages/     # Shared packages
│   └── pnpm-workspace.yaml
│
├── sdk/              # Python SDK for users
│   └── agenta/
│       ├── client/   # Client library
│       └── sdk/      # Core SDK
│
├── services/         # Background workers
│   ├── oss/          # Worker implementations
│   └── entrypoints/  # Worker entrypoints
│
├── examples/         # Example applications
├── docs/             # Documentation
└── hosting/          # Docker/k8s configurations
```

## 3. API Architecture (FastAPI)

### Layered Architecture

```
┌─────────────────────────────────────────┐
│         ROUTERS (API Layer)             │
│  apis/fastapi/*/router.py               │
│  - Request/Response models (models.py)  │
│  - Route handlers                       │
│  - Exception handling                   │
├─────────────────────────────────────────┤
│         SERVICES (Core Layer)           │
│  core/*/service.py                      │
│  - Business logic                       │
│  - Cross-domain orchestration           │
│  - Domain logic & validation            │
├─────────────────────────────────────────┤
│            DAOs (Data Layer)            │
│  dbs/postgres/*/dao.py                  │
│  - Database queries                     │
│  - CRUD operations                      │
├─────────────────────────────────────────┤
│            DBEs (Entity Layer)          │
│  dbs/postgres/*/dbes.py                 │
│  - SQLAlchemy models                    │
│  - Database schema                      │
└─────────────────────────────────────────┘
```

### API Domains (FastAPI Routers)

| Domain           | Path                          | Description                |
| ---------------- | ----------------------------- | -------------------------- |
| **Applications** | `/applications`, `/apps`      | App management             |
| **Workflows**    | `/workflows`                  | Workflow definitions       |
| **Environments** | `/environments`               | Deployment environments    |
| **Evaluations**  | `/evaluations`                | LLM evaluation runs        |
| **Evaluators**   | `/evaluators`                 | Evaluation logic/metrics   |
| **Testsets**     | `/testsets`                   | Test data management       |
| **Testcases**    | `/testcases`                  | Individual test cases      |
| **Queries**      | `/queries`                    | Query history              |
| **Tracing**      | `/tracing`, `/preview/traces` | Observability              |
| **Invocations**  | `/invocations`                | App invocations            |
| **Annotations**  | `/annotations`                | Trace annotations          |
| **Events**       | `/events`                     | Event logging              |
| **Vault**        | `/vault/v1`                   | Secret management          |
| **Webhooks**     | `/webhooks`                   | Webhook configs            |
| **Folders**      | `/folders`                    | Organization               |
| **Tools**        | `/preview/tools`              | External tool integrations |
| **Auth**         | `/auth`                       | Authentication             |
| **AI Services**  | `/ai/services`                | LLM provider config        |

### OSS + EE Architecture Pattern

```python
# api/entrypoints/routers.py
from oss.src.utils.common import is_ee

# Load OSS first
from oss.src.apis.fastapi.workflows.router import WorkflowsRouter
# ... other OSS imports

# Conditional EE extension
ee = None
if is_ee():
    import ee.src.main as ee

app = FastAPI(...)

# Mount OSS routers
app.include_router(workflows.router, prefix="/workflows", ...)

# If EE, extend the app
if ee and is_ee():
    app = ee.extend_main(app)       # Add routers/features
    app = ee.extend_app_schema(app) # Add OpenAPI metadata
```

**EE Modules** (in `api/ee/src/`):

- `core/` - Billing, organizations, workspaces, subscriptions
- `dbs/` - EE database models
- `services/` - EE-specific services (throttling, etc.)
- `routers/` - EE-only endpoints

## 4. Database Architecture

### Git-based Revision System

Agenta uses a **Git-like pattern** for revision management:

```
┌──────────────────────────────────────────────┐
│             REVISION PATTERN                 │
├──────────────────────────────────────────────┤
│                                              │
│  Artifact ───→ Variant ───→ Revision         │
│     │             │             │            │
│     │             │             └── timestamp│
│     │             │             └── state    │
│     │             │             └── parent   │
│     │             └── name                   │
│     └── id                                   │
│                                              │
│  Example:                                    │
│  Workflow (Artifact)                         │
│    └── "Production Bot" (Variant)            │
│         └── v1, v2, v3 (Revisions)           │
│                                              │
└──────────────────────────────────────────────┘
```

### Database Domains (`dbs/postgres/`)

| Domain            | Storage Pattern    | Description               |
| ----------------- | ------------------ | ------------------------- |
| **workflows**     | Git-based          | App/workflow definitions  |
| **testsets**      | Git-based          | Test data with revisions  |
| **queries**       | Git-based          | Query history             |
| **environments**  | Git-based          | Environment configs       |
| **evaluations**   | SQL (relational)   | Evaluation results        |
| **tracing**       | SQL + dedicated DB | Trace/span storage        |
| **events**        | SQL (append-only)  | Event log                 |
| **users**         | SQL                | User accounts             |
| **organizations** | SQL                | Multi-tenant orgs         |
| **folders**       | SQL                | Hierarchical organization |
| **secrets**       | SQL (encrypted)    | Vault/secrets             |
| **webhooks**      | SQL                | Webhook configs           |
| **tools**         | SQL                | External tool registry    |

### Shared Components

- **Git DAO** (`dbs/postgres/git/dao.py`): Generic revision storage
- **Shared DTOs** (`core/git/dtos.py`): Common revision contracts

## 5. Frontend Architecture (Next.js)

### Package Structure

```
web/
├── oss/                      # Main OSS application
│   ├── src/
│   │   ├── pages/           # Next.js pages (App Router)
│   │   ├── components/      # React components
│   │   ├── hooks/           # Custom hooks
│   │   ├── state/           # Jotai atoms
│   │   └── lib/             # Utilities
│   └── package.json
│
├── ee/                       # Enterprise overlay
│   └── src/                  # EE-specific pages/components
│
└── packages/                 # Shared packages
    ├── agenta-ui/           # UI components library
    ├── agenta-entities/     # Entity state management (molecules)
    ├── agenta-entity-ui/    # Entity selection UI
    ├── agenta-shared/       # Pure utilities
    ├── agenta-playground/   # Playground components
    ├── agenta-annotation/   # Annotation system
    └── ...
```

### State Management

1. **Jotai** - Atomic state management
2. **TanStack Query** - Server state (via `jotai-tanstack-query`)
3. **Molecule Pattern** - Entity CRUD with draft state

### Route Structure

```
/auth/login
/auth/signup
/get-started
/workspaces
/w/[workspace_id]/
    /p/[project_id]/
        /apps/
        /observability/
        /playground/
        /testsets/
        /evaluations/
        /settings/
        /...
```

## 6. SDK Architecture

```
sdk/
└── agenta/
    ├── __init__.py          # Main entry: agenta.init()
    ├── client/              # HTTP client
    │   └── client.py
    └── sdk/
        ├── base.py          # Base classes
        ├── decorators.py    # @agenta.entrypoint
        └── types.py         # Type definitions
```

### SDK Usage Pattern

```python
import agenta as ag

ag.init(api_url="http://localhost:8000")

@ag.entrypoint
def generate(prompt: str) -> str:
    # Your LLM app logic
    return llm.generate(prompt)
```

## 7. Key Dependencies

### Backend (Python)

| Category      | Technologies                    |
| ------------- | ------------------------------- |
| Framework     | FastAPI, Pydantic, Uvicorn      |
| Database      | PostgreSQL, SQLAlchemy, Alembic |
| Cache/Queue   | Redis, Taskiq                   |
| Auth          | SuperTokens                     |
| Observability | OpenTelemetry, Structlog        |
| LLM           | OpenAI, LiteLLM                 |
| Payments      | Stripe                          |

### Frontend (TypeScript/React)

| Category   | Technologies          |
| ---------- | --------------------- |
| Framework  | Next.js 15, React 19  |
| UI Library | Ant Design 6          |
| State      | Jotai, TanStack Query |
| Styling    | Tailwind CSS          |
| Editor     | Monaco, Lexical       |
| Charts     | Recharts, Tremor      |

### Services

| Service    | Technology          |
| ---------- | ------------------- |
| Workers    | Python, Taskiq      |
| Containers | Docker              |
| Deployment | Docker Compose, K8s |

## 8. Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      REQUEST FLOW                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  User Action                                                     │
│      ↓                                                           │
│  React Component (Next.js)                                       │
│      ↓                                                           │
│  Jotai Atom / TanStack Query                                     │
│      ↓                                                           │
│  API Client (axios)                                              │
│      ↓                                                           │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │  API (FastAPI)                                          │     │
│  │      ↓                                                  │     │
│  │  Router (validates request)                             │     │
│  │      ↓                                                  │     │
│  │  Service (business logic)                               │     │
│  │      ↓                                                  │     │
│  │  DAO (data access)                                      │     │
│  │      ↓                                                  │     │
│  │  DBE (SQLAlchemy) → PostgreSQL                          │     │
│  └─────────────────────────────────────────────────────────┘     │
│      ↓                                                           │
│  Response                                                        │
│      ↓                                                           │
│  Frontend updates (React re-render)                              │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## 9. Key Patterns

### Domain-Driven Layering

Each domain follows the same pattern:

```
api/oss/src/
├── apis/fastapi/{domain}/
│   ├── router.py      # API routes
│   ├── models.py      # Request/Response schemas
│   └── utils.py       # Parsing helpers
├── core/{domain}/
│   ├── dtos.py        # Domain contracts
│   ├── types.py       # Domain types/exceptions
│   ├── interfaces.py  # Service contracts
│   └── service.py     # Business logic
└── dbs/postgres/{domain}/
    ├── dbes.py        # SQLAlchemy entities
    ├── dao.py         # Database access
    └── mappings.py    # DTO ↔ DBE mapping
```

### Evaluation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  EVALUATION PIPELINE                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Create Evaluation (API)                                 │
│     ↓                                                       │
│  2. Queue Job (Taskiq/Redis)                                │
│     ↓                                                       │
│  3. Worker picks up job                                     │
│     ↓                                                       │
│  4. For each testcase:                                      │
│     - Load app variant                                      │
│     - Execute with test input                               │
│     - Run evaluators                                        │
│     - Store results                                         │
│     ↓                                                       │
│  5. Poll results via API                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 10. Configuration Management

```python
# api/oss/src/utils/env.py
from pydantic_settings import BaseSettings

class Env:
    @property
    def database_url(self) -> str:
        ...

    @property
    def redis_url(self) -> str:
        ...

env = Env()
```

Environment variables are centralized and typed, following the pattern in the AGENTS.md.

---

## Summary

Agenta is a comprehensive **LLMOps platform** with:

- **Full-stack capabilities**: Frontend (Next.js), Backend (FastAPI), SDK (Python)
- **Multi-tenant architecture**: Organizations → Workspaces → Projects
- **Git-based versioning**: Artifacts → Variants → Revisions
- **OSS + EE split**: Open core with enterprise extensions
- **Rich evaluation**: Testset management, evaluators, evaluation workflows
- **Observability**: Tracing, spans, annotations
- **Tool integrations**: Composio and other external tools
- **Secret management**: Vault for secure storage
