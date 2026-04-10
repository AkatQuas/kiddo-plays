# Wails

[wailsapp/wails](https://github.com/wailsapp/wails), still a young, in-development cross-platform framework.

Not many tutorials, community packages or resources.

Much suitable for Go programmers who want to bundle an HTML/JS/CSS frontend with their applications, without resorting to creating a server and opening a browser to view it.

## About

This is the official Wails React-TS template.

You can configure the project by editing `wails.json`. More information about the project settings can be found
here: https://wails.io/docs/reference/project-config .

The main points of interaction between the frontend and your Go code are:

- Calling [bound Go methods](https://wails.io/docs/howdoesitwork#calling-bound-go-methods)
- Calling [runtime methods](https://wails.io/docs/reference/runtime/intro)

To develop in the browser and call your bound Go methods from Javascript, navigate to: http://localhost:34115 .

## Live Development

To run in live development mode, run `wails dev` in the project directory. This will run a Vite development
server that will provide very fast hot reload of your frontend changes. If you want to develop in a browser
and have access to your Go methods, there is also a dev server that runs on http://localhost:34115. Connect
to this in your browser, and you can call your Go code from devtools.

## Building

To build a redistributable, production mode package, use `wails build`.
