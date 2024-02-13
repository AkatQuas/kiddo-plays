# Acknowledgement

This is a folk with comments on the repository [ArturoDent / read-only-non-workspace](https://github.com/ArturoDent/read-only-non-workspace).

```ts
vscode.window.tabGroups;

vscode.window.onDidChangeActiveTextEditor;
```

Keyframe: focus group and then freeze it (`workbench.action.files.setActiveEditorReadonlyInSession`).

# Read-only: Non-workspace Files

This extension will automatically set any non-workspace files to **read-only** in the editor. This does **NOT** change their read/write status in the filesystem.

This works for any non-workspace files upon start-up (or reload) of vscode and when opening a file in an existing workspace (as by dragging and dropping from a file explorer for example).

Works in single and multi-root workspaces.

A lock icon will appear in the editor tab for any file set as read-only.

## Extension Settings

This extension contributes the following settings:

- `Read-only > Non-workspace Files: Enable`: enable/disable this extension

Disabling the extension does **NOT** unset any read-only files that may already be present.

You can undo any read-only file setting by attempting to type in that file. VS Code will automatically offer a suggestion to change that file's read-only status. However, if you then reload VS Code, that same file (if a non-workspace file) would again be marked as read-only.

You can toggle or unset `read-only` with these commands:

```plaintext
File: Toggle Active Editor Read-only in Session

File: Reset Active Editor Read-only in Session
```

## Known Issues

If you have more than 8 editor groups open - and one of those beyond 8 is the active group - this extension cannot properly refocus the active editor group after setting any non-workspace files to read-only.

## Release Notes

- 0.1.0 Initial release.
