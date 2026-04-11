# bun naive

A Bun-powered server with API routes and HTML pages.

## Quick Start

```bash
bun install
bun run src/index.ts
```

## VS Code Tasks

Press `Cmd+Shift+P` → "Tasks: Run Task" to execute:

| Task             | Description                               |
| ---------------- | ----------------------------------------- |
| **Installation** | Install dependencies                      |
| **Development**  | Start dev server                          |
| **Test**         | Run tests                                 |
| **Build**        | Not working, Bundle to `./dist`           |
| **Compile**      | Not working, Compile to standalone binary |

## Server

[src/index.ts](./src/index.ts)

## Tech Stack

- [Bun](https://bun.sh) - Runtime
- [bun:test](https://bun.sh/docs/runtime/test) - Testing framework
