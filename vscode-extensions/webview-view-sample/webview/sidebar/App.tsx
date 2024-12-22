import * as React from "react";
import { initVSCode } from "../shared/vscode";
import { State, Color } from "./interface";
import { CustomMessageEvent } from "../shared/json-rpc-client";

const { rpcClient, vscode, vscodeInWebview } = initVSCode<State>();

function getNewColor(): string {
  const colors = ["020202", "f1eeee", "a85b20", "daab70", "efcb99"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const [colorState, setColorState] = React.useState<State>(() => {
    return vscodeInWebview.getState() || { colors: [] };
  });

  function addColor() {
    setColorState((r) => ({
      colors: [...r.colors, { value: getNewColor() }],
    }));
  }

  React.useEffect(() => {
    const handler = async (e: CustomMessageEvent) => {
      const message = e.data;
      switch (message.event) {
        case "addColor":
          addColor();
          break;
        case "clearColors":
          setColorState({ colors: [] });
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  const showNotification = () => {
    vscode.window
      .showInputBox({
        value: "choose your name",
      })
      .then((result) => {
        vscode.window.showInformationMessage("Hello, " + result);
      });
  };
  const showCustomLogger = () => {
    rpcClient.call("customLogger", ["hello 42", 99]).then((result) => {
      console.debug(
        "\x1B[97;100;1m --- rpc call Custom Logger success --- \x1B[m",
        "\n",
        { result }
      );
    });
  };

  return (
    <div>
      <p>This is a sidebar webview.</p>
      <button className="add-color-button" onClick={showCustomLogger}>
        show custom logger
      </button>
      <button className="add-color-button" onClick={showNotification}>
        show notification
      </button>

      <button className="add-color-button" onClick={addColor}>
        Add Color
      </button>
      <ul className="color-list">
        {colorState.colors.map((color, index) => {
          return (
            <li className="color-entry" key={index}>
              <div
                className="color-preview"
                style={{ backgroundColor: `#${color.value}` }}
              ></div>
              <input
                disabled
                className="color-input"
                type="text"
                value={color.value}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
