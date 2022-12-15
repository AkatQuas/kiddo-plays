import * as vs from 'vscode';

export enum Theme {
  Unknown,
  Dark,
  Light,
  HighContrast,
}

interface themeDetectorArgs {
  cssVars: Record<string, string>;
  bodyClass?: string;
}

export function detectTheme(
  disposables: vs.Disposable[],
  channel: vs.OutputChannel
): Promise<themeDetectorArgs | undefined> {
  return new Promise((resolve) => {
    let panel: vs.WebviewPanel | undefined = createPanel();
    const messageHandler = (detectorResult?: themeDetectorArgs) => {
      if (panel) {
        panel.dispose();
        panel = undefined;
      }

      console.log(
        `%c***** msg *****`,
        'background: #3C89FF; color: #f8f8f8; padding: 10px;margin-bottom: 5px;',
        '\n',
        detectorResult
      );
      resolve(detectorResult);
      detectorResult &&
        channel.appendLine(JSON.stringify(detectorResult.cssVars, null, 2));
    };

    // After a second, just resolve as unknown.
    setTimeout(() => messageHandler(), 30000);

    panel.webview.onDidReceiveMessage(messageHandler, undefined, disposables);
    panel.webview.html = themeDetectorScript;
  });
}

const themeDetectorScript = `
<html>
  <body>
    <script>
      const vscode = acquireVsCodeApi();
      const style = document.getElementsByTagName('html')[0].style;
      vscode.postMessage({
        cssVars: Object.values(style)
          .filter((s) => s.startsWith('--vscode')).sort(),
        //   .reduce((acc, rv) => ({
        //     [rv]: style.getPropertyValue(rv),
        //   })),
        themeClass: document.body.className,
      });
    </script>
  </body>
</html>
`;

function createPanel() {
  return vs.window.createWebviewPanel(
    'theme-detector',
    '',
    {
      preserveFocus: true,
      viewColumn: vs.ViewColumn.Beside,
    },
    {
      enableScripts: true,
      localResourceRoots: [],
    }
  );
}

function parseClass(bodyCssClass: string): Theme {
  if (bodyCssClass && bodyCssClass.indexOf('vscode-dark') !== -1) {
    return Theme.Dark;
  } else if (bodyCssClass && bodyCssClass.indexOf('vscode-light') !== -1) {
    return Theme.Light;
  } else if (
    bodyCssClass &&
    bodyCssClass.indexOf('vscode-high-contrast') !== -1
  ) {
    return Theme.HighContrast;
  } else {
    return Theme.Unknown;
  }
}
