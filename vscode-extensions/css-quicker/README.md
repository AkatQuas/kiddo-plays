# css-quicker README

CSS quicker for html file.

## Features

1. class/id selector completion
1. class/id selector hover
1. class/id selector definition

## Extension Settings

This extension contributes the following settings:

- `css-quicker.enableHover`: enable/disable hover features
- `css-quicker.enableCompletion`: enable/disable completion features
- `css-quicker.enableDefinition`: enable/disable definition features
- `css-quicker.enableCompletion2`: enable/disable completion features2
- `css-quicker.enableDefinition2`: enable/disable definition features2

## Development

Open the _Extension Development Host_ with the [samples](./samples) folder. Modify the `.vscode/settings.json` if necessary.

## Tips

```typescript
const stylesheet = getCSSLanguageService().parseStylesheet(CSSTextDocument);

// traverse the node by accept function
(stylesheet as any).accept((node: any) => {
  // https://github.com/microsoft/vscode-css-languageservice/blob/main/src/parser/cssNodes.ts#L29-L30
  if (node.type === 14 || node.type === 15) {
    console.log(`node type : ` + node.getText());
  }
  return true;
});
```
