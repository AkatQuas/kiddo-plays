# MCP Demo: Weather

This is a demo of the MCP protocol in TypeScript. It demonstrates how to create a simple MCP server that exposes a weather tool and some data.

## Development and Debugging

> [More details about MCP Inspector](https://modelcontextprotocol.io/docs/tools/inspector)

When you write the server but you don't have any client, you can use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to debug your server.

After you write the capabilities of your server, you can use the MCP Inspector to debug your server.

Use VS Code Task to build the server in watch mode and start the debugger.

Choose `Tasks: Run Task` and choose `Inspect (SSE)` from VS Code command palette.

![](./docs/sse.png)

<details>
<summary>

MCP Inspector through CLI (Not recommended).

</summary>

The `tsx` would not generate a `dist` folder, so you might need to start the task each time when you make changes.

Choose `Tasks: Run Task` and choose `Inspect (CLI)` from VS Code command palette.

![](./docs/cli.png)

</details>


## References

- [MCP Protocol](https://modelcontextprotocol.io/introduction)

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

- [Figma Context MCP](https://github.com/GLips/Figma-Context-MCP): A great showcase for MCP.
