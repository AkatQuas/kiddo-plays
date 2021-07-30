# lang-server README

This is the README for your extension "lang-server". After writing up a brief description, we recommend including the following sections.

## Running the Sample

- Run `yarn` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press `yarn compile` to compile the client and server.
- Switch to the Debug (`Meta+Shift+D`) viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.

If you want to debug the server as well use the launch configuration `Attach to Server`.
In the [Extension Development Host] instance of VSCode, open a document in 'plain text' language mode.

- Type `j` or `t` to see `Javascript` and `TypeScript` completion.
- Enter text content such as `AAA` aaa `BBB`. The extension will emit diagnostics for all words in all-uppercase.
