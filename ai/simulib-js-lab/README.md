# simulib-js-lab

小型探测项目，用来试 [`@simular/simulib-js`](https://www.npmjs.com/package/@simular/simulib-js)（当前钉在 `3.4.0`）。这是 Simular 的桌面自动化原生绑定：应用与窗口、无障碍树、剪贴板、截图、键鼠。

调用是同步的。坐标是屏幕左上角为原点的物理像素。

## 准备

需要 Node.js 20+。各系统实际能加载、能截图的版本下限比包声明的更高，见 [docs/version-limits.md](docs/version-limits.md)。macOS 上，无障碍树需要把**启动 Node 的终端**加到「系统设置 → 隐私与安全性 → 辅助功能」；截图还需要「屏幕录制」。

```bash
npm install
npm run probe
```

`npm run probe` 只跑安全套件，不会点击、打字、关窗口或启动应用。剪贴板会短暂写入一条探测字符串，然后立刻还原。

## `src` 里的文件

四个文件都是 ESM，在项目根目录用 `node` 跑。`browser-window.mjs` 只被另外两个脚本引入，不要单独执行。

### `src/probe.mjs`

只读探测。不点击、不打字、不关窗口、不启动应用。剪贴板会短暂写入一条探测字符串，然后立刻还原。

```bash
npm run probe                         # 跑下面全部套件
node src/probe.mjs load apps files    # 只跑点名的套件
```

| 套件 | 做什么 |
| --- | --- |
| `load` | 加载原生模块，列出全部导出 |
| `apps` | `System.listApps()`，并模糊查找 TextEdit（Windows 上是 Notepad） |
| `windows` | 列出可见顶层窗口的 pid 和标题 |
| `files` | 在临时目录里写文件、读回、删除 |
| `clipboard` | 写入并读回剪贴板，然后还原原内容 |
| `screenshot` | 截主屏，存到 `out/screenshot.png`。macOS 13 上会把进程打崩，见版本文档 |
| `ax` | 抓前台窗口的无障碍树，只读，不点击 |

不写套件名，或写成 `safe` / `all`，效果和 `npm run probe` 一样。

### `src/open-url.mjs`

用系统默认浏览器打开一个 URL，抢到前台后打印该窗口的无障碍树。不传参数时打开 `https://example.com`。

```bash
npm run open
node src/open-url.mjs https://example.com
```

Windows 上 `App.open` 返回的 pid 经常没有顶层窗口。脚本会先等这个 pid 出现窗口；等不到就改用标题里带主机名的浏览器窗口，或当前前台浏览器窗口。

### `src/bing-search.mjs`

打开 Chrome，访问 `https://cn.bing.com`，把「洛天依」写入页面搜索框并点搜索按钮。成功后截图到 `out/bing-luotianyi.png`。会抢焦点。

```bash
npm run bing
node src/bing-search.mjs
```

搜索词和网址写在文件顶部的 `QUERY`、`PAGE`。macOS 上会调用 `enableAccessibility()`，因为 Chrome 默认不暴露无障碍树；Windows 上这个方法还没实现，脚本会跳过。窗口 pid 的解析和 `open-url.mjs` 相同。

### `src/browser-window.mjs`

给上面两个脚本共用的 `resolveBrowserPid(launchPid, { hint })`。它返回真正拥有可见窗口的进程号，供 `AccessibilityTree.fromPid` 使用。`hint` 是窗口标题里要包含的片段，比如 `example` 或 `bing`。

上游包自带的例子在 `node_modules/@simular/simulib-js/examples/`。其中 `keyboard.mjs` 会向当前焦点输入文字，需要先点进一个文本框再单独跑。
