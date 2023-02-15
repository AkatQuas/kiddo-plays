# ESLint Demo

The dependencies are not installed at the project root, but in different location, `infra/node_modules` in this project.

```json
// package.json
{
  "scripts": {
    // pnpm is required
    "preinstall": "echo $npm_execpath | grep -q pnpm || { echo 'Use `pnpm` to install'; exit 1; }",
    // move the node_modules
    "postinstall": "rm -rf infra/node_modules || true; mv node_modules infra/"
  }
}
```

However, `vscode-eslint` doesn't work well even if `eslint.nodePath` is set to `infra/node_modules`, see [issue#1603](https://github.com/microsoft/vscode-eslint/issues/1603).

> TL;DR
> The eslint server starts correctly within the vscode-extension.
> But it couldn't resolve configuration well.

Here is just a [experimental way](./scripts/post-link.sh) to solve the problem.

**Create a phantom `node_modules` in the project root**.

Weird but useful.
