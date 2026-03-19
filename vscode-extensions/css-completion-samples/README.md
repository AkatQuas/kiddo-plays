# CSS Completion Samples

A workspace containing two sample projects that demonstrate how to implement **CSS class-name completion in HTML files** for Visual Studio Code.

- `css-completion` — A **pure client-side** extension (single extension process) using the VS Code Extension API.
- `css-completion-lsp` — A **client/server design** using the **Language Server Protocol (LSP)**, with a separate language server process.

---

## 🎯 Goal

These samples are aimed at developers who want to learn how to build editor tooling in VS Code. You will learn how to:

- Register completion providers for HTML and provide `CompletionItem`s.
- Read and parse CSS files from the workspace to extract class selectors.
- Wire completion results into the editor based on cursor/context.
- Structure a VS Code extension in both **single-process** and **LSP** architectures.
- Write basic end-to-end tests for completion features.

---

## 📦 Projects

### 1) `css-completion` (Pure client)

This is a minimal extension that demonstrates the simplest way to provide completion suggestions.

- Uses the VS Code Extension API only (`vscode` module).
- Implements a `CompletionItemProvider` for HTML.
- Scans CSS files in the same folder as the active HTML document and parses class selectors.
- Provides completion suggestions inside `class="..."` attributes.

📍 See: [`css-completion/src/extension.ts`](./css-completion/src/extension.ts) and [`css-completion/tutorial.md`](./css-completion/tutorial.md)

---

### 2) `css-completion-lsp` (Client + Server)

This is a more advanced sample showing how to build a language feature using the **Language Server Protocol**.

- Splits responsibilities between a **Client** (VS Code extension) and a **Server** (language server process).
- Uses `vscode-languageclient` to communicate with the server.
- Implements completion logic in the server so it can be reused by other editors that support LSP.
- Includes end-to-end tests that launch the client + server and validate completion behavior.

📍 See: [`css-completion-lsp/client/src/extension.ts`](./css-completion-lsp/client/src/extension.ts) and [`css-completion-lsp/server/src/server.ts`](./css-completion-lsp/server/src/server.ts)

---

## ▶️ Running the Samples

### Run the pure client sample

```bash
cd css-completion
npm install
# Then open this folder in VS Code and press F5 to launch the extension host.
```

### Run the LSP sample

```bash
cd css-completion-lsp
npm install
# Then open this folder in VS Code and press F5 to launch the client + server.
```

> Tip: Open the `samples/` folder (`css-completion/samples/`) or the `client/testFixture/` folder (`css-completion-lsp/client/testFixture/`) and open `a.html` to try the completion.

---

## 🧠 What You Can Learn from This Repo

- How to hook into VS Code completion for specific languages (HTML).
- How to parse CSS files for relevant tokens (class selectors).
- How to structure VS Code extensions for maintainability.
- The differences between single-process extensions and LSP-based solutions.
- How to add tests for language features.

---

## 🚀 Next Steps (Ideas)

If you want to extend these samples, consider:

- Supporting `id` completions (`#id`) or attribute selectors.
- Handling nested folders and workspace-wide CSS discovery.
- Adding caching/invalidation when CSS files change.
- Enhancing parsing to support Sass/LESS or more complex selector patterns.

---

## 📄 License

This repo is provided as-is for learning and experimentation.
