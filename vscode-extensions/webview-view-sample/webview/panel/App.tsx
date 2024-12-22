import * as React from "react";
import { initVSCode } from "../shared/vscode";
import { State, Color } from "./interface";
import { CustomMessageEvent } from "../shared/json-rpc-client";

const { vscode, vscodeInWebview } = initVSCode<State>();

function getNewColor(): string {
  const colors = ["020202", "f1eeee", "a85b20", "daab70", "efcb99"];
  return colors[Math.floor(Math.random() * colors.length)];
}

export default function App() {
  const [colorState, setColorState] = React.useState<State>(() => {
    return vscodeInWebview.getState() || { colors: [] };
  });

  function addNumber() {
    setColorState((r) => ({
      colors: [...r.colors, { value: getNewColor() }],
    }));
  }

  React.useEffect(() => {
    const handler = async (event: CustomMessageEvent) => {
      const message = event.data;
      switch (message.event) {
        case "addNumber":
          addNumber();
          break;
        case "clearNumber":
          setColorState({ colors: [] });
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  return (
    <div>
      <p>This is a panel webview.</p>
      <button className="add-color-button" onClick={addNumber}>
        Add Number
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
              <span>{index}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
