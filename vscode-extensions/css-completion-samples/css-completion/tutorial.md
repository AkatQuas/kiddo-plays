# A Simple CSS Class Selector Completion Plugin

> [中文版本](./tutorial.zhCN.md)

When writing code in `HTML` files, one frustrating thing is adding class selectors to the `class` attribute.

```html
<div class="?"></div>
```

Class selectors defined in CSS files can sometimes be quite long, so typing them manually often leads to typos. The usual approach is to open the HTML file on one side and the corresponding CSS file on the other, then copy a class selector from the CSS file and paste it into the HTML file. Like in the image below — this method is quite tedious.

![](./copy-paste.gif)

Therefore, it would be very convenient if the editor had an auto-completion feature.

Next, this article will guide you step by step to implement a VS Code extension that provides auto-completion for CSS class selectors.

> The sample extension is relatively simple and only supports suggestions for files with the same name in the same directory. It is mainly for practice purposes.

## Basic Knowledge

VS Code provides the [API `registerCompletionItemProvider`](https://code.visualstudio.com/api/references/vscode-api#languages), which allows an extension to register a completion provider when activated. A simple example is shown below.

```typescript
const provider = {
  provideCompletionItems(document, position, token, context) {
    /* Returns an array of CompletionItem,
     or an asynchronous Promise<CompletionItem[]> */
  }
};
vscode.languages.registerCompletionItemProvider(
  'html' /* language id */,
  provider,
  '"' /* trigger character */,
  '=' /* trigger character */
  // ...
);
```

`registerCompletionItemProvider` accepts multiple parameters:

- The first parameter specifies the target files. The subsequent provider will only be triggered when editing these target files.

- The second parameter is an object with a `provideCompletionItems` method, which defines the possible completion results returned when completion is triggered. It can return a `CompletionItem` array synchronously or a `Promise&lt;CompletionItem[]&gt;` asynchronously.

- Starting from the third parameter, all are single-character strings used as `triggerCharacter`, indicating the characters that trigger the `provideCompletionItems` method.

The first two parameters of the `provideCompletionItems` method in the provider, `document` and `position`, represent the currently edited file and the cursor position respectively. The other two parameters are not needed for now; interested readers can study the relevant API documentation.

## Process Overview

The completion process is designed as shown below:

![](./procedure.png)

When editing the `class` attribute in an HTML file, read the CSS file with the same name in the same directory, parse its Stylesheet, and retrieve all _class selectors_ from it. Deduplicate the text of these class selectors, construct an array of `CompletionItem` objects, and return the completion results.

## Key Implementations

There are two prerequisites for class selector completion:

- The `languageId` of the edited `document` must be `html`.

- The edit `position` must be inside _an attribute value_, and the attribute name must be `class`, not other attributes such as `onclick`.

The prerequisite check can be implemented using the following function, with [inspiration from here](https://github.com/microsoft/vscode-extension-samples/blob/355d5851a8e87301cf814a3d20f3918cb162ff73/lsp-embedded-request-forwarding/client/src/embeddedSupport.ts#L31-L50).

The `ensureAttribute` function scans the token stream of the HTML file, records the text of each `AttributeName` token, and checks when the next `AttributeValue` token is encountered.

When the `AttributeName` is `class`, it then uses the offset to determine whether the position meets the completion requirements.

```typescript
function ensureAttribute(htmlLanguageService, document, position) {
  const scanner = htmlLanguageService.createScanner(document.getText());
  const offset = document.offsetAt(position);
  let lastAttributeName: string | null = null;
  let token = scanner.scan();
  while (token !== TokenType.EOS) {
    switch (token) {
      case TokenType.AttributeName:
        // Record the attribute name
        lastAttributeName = scanner.getTokenText();
        break;
      case TokenType.AttributeValue:
        if (!lastAttributeName) {
          break;
        }
        if (lastAttributeName === 'class') {
          // Check if the offset of the position meets the requirement
          if (
            offset > scanner.getTokenOffset() &&
            offset < scanner.getTokenEnd()
          ) {
            return true;
          }
        }
      default:
        break;
    }
    token = scanner.scan();
  }
  return false;
}
```

Next, we parse the CSS file with the same name in the same directory. For convenience, we use `vscode-css-languageservice` for parsing. The result is an AST node of type `Stylesheet`, whose structure can be referenced at [cssNode.ts#Stylesheet](https://github.com/microsoft/vscode-css-languageservice/blob/a2417092c382f4ac2f86145d0c44d6bce1279ae1/src/parser/cssNodes.ts#L443).

We use the `accept` method of Stylesheet to traverse the AST. The method definition is available [here](https://github.com/microsoft/vscode-css-languageservice/blob/a2417092c382f4ac2f86145d0c44d6bce1279ae1/src/parser/cssNodes.ts#L226-L232).

```typescript
async function parseCss(cssLanguageService, htmlDocument) {
  /* Construct the path to the CSS file */
  const cssUri = htmlDocument.uri.with({
    path: htmlDocument.uri.path.slice(0, -4) + 'css'
  });

  /* Open the file using VS Code's API */
  const cssDocument = await vscode.workspace.openTextDocument(cssUri);

  /* Reconstruct textDocument to meet type requirements */
  const styleDocument = ServerTextDocument.create(
    cssUri.toString(),
    'css',
    cssDocument.version,
    cssDocument.getText()
  );

  /* Parse and obtain the stylesheet AST */
  return cssLanguageService.parseStylesheet(styleDocument);
}
```

## Completing the CompletionProvider

The above two sections are the key steps of the extension. Now we connect them together to complete the entire provider functionality.

```typescript
const provider = {
  async provideCompletionItems(document, position, _token, _context) {
    const attributeResult = ensureAttribute(
      htmlLanguageService,
      document,
      position
    );
    if (!attributeResult) {
      return [];
    }

    const stylesheet = await parseCss(cssLanguageService, document);

    // Deduplicate class names
    const raw: Set<string> = new Set();

    // Traverse the stylesheet AST node
    (stylesheet as any).accept((node: any) => {
      // ClassSelector enum value is 14
      // https://github.com/microsoft/vscode-css-languageservice/blob/main/src/parser/cssNodes.ts#L29
      if (node.type === 14) {
        // Remove the leading dot `.`
        raw.add(node.getText().substr(1));
      }

      // Return true to continue traversing child nodes
      return true;
    });

    // Construct CompletionItem and return the results
    return Array.from(raw).map(
      (selector) => new CompletionItem(selector, CompletionItemKind.Color)
    );
  }
};
```

## Running the Extension

In VS Code, open an empty extension project created with [`yo code`](https://code.visualstudio.com/api/get-started/your-first-extension), integrate the code above, and run the extension by pressing F5. The effect is shown below:

![](./auto-completion.gif)
