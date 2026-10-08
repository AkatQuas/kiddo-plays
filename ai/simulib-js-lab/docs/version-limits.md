# `@simular/simulib-js` 版本限制

记录日期：2026-10-08。测试项目钉的是 **`@simular/simulib-js@3.4.0`**。结论来自 npm 元数据、预编译二进制的 Mach-O / ELF 符号，以及 macOS 13.7.8、macOS（Darwin 27）上的实际运行。

包自己的说明只写了 Node.js 20+ 和六套 CPU 架构。能加载、能截图的系统版本比这个更高，而且换包名后的新版本没有放宽。

## 发布了哪些包

| npm 包 | 已发布版本 | 说明 |
| --- | --- | --- |
| `@simular/simulib-js` | 只有 **3.4.0** | 本项目使用的名字 |
| `@simular-ai/simulib-js` | 5.4.3、5.4.4 | 同一库，换到组织 scope |
| `@simular-ai/simulang-js` | npm 最新 **13.0.0** | 仓库已改名。GitHub `main` 的 changelog 写到 14.0.0，当时 npm 上还没有 |

三份包的 `engines` 都是 `node >= 20`。预编译目标都是：

| 系统 | 架构 |
| --- | --- |
| macOS | Apple Silicon（`darwin-arm64`）、Intel（`darwin-x64`） |
| Windows | x64、ARM64，MSVC |
| Linux | x64、ARM64，glibc。没有 musl 包 |

`simulang` 命令行另要 Node.js **22.18+**，那是它自己剥 TypeScript 的要求，不是这个原生库的要求。仓库 `.nvmrc` 里的 25 只是开发机版本。

## macOS

Intel 二进制的 Mach-O 最低版本是 **10.13**，Apple Silicon 是 **11.0**，两边的 SDK 都是 **15.5**。这不是实际能跑的版本。

二进制**强链接** `ScreenCaptureKit.framework`。这个框架从 **macOS 12.3** 才有，所以 12.3 以前模块加载就会失败。截图走的是 `SCScreenshotManager`，这个类从 **macOS 14.0**（Sonoma，WWDC23）才有。

因此 macOS 上是两层：

- **12.3 起** 模块能加载。列应用、窗口、文件、剪贴板、无障碍树不走截图类。
- **14.0 起** `screenshotFull` / `screenshotCropped` 才不会因为缺类而把进程打崩。

macOS 13.7.8（Ventura，Intel，Node v22.22.0）上的实测：`load`、`apps`、`windows`、`files`、`clipboard` 通过；`screenshotFull` 在原生线程里 panic，JavaScript `try/catch` 接不住：

```text
class SCScreenshotManager could not be found
```

panic 位置是 `objc2-screen-capture-kit-0.3.2` 的 `SCScreenshotManager.rs`。屏幕录制权限已经授予时也是这个错误。权限不够时，库会返回空图或抛一个能被接住的异常，不会报 class not found。

`@simular-ai/simulib-js@5.4.4` 和 `@simular-ai/simulang-js@13.0.0` 的 Intel 二进制仍引用同一个 `SCScreenshotManager`，最低版本标记仍是 10.13。升级解决不了 Ventura 上的截图崩溃。

CI 把 `MACOSX_DEPLOYMENT_TARGET` 设成 10.13，和 Intel 二进制上的标记一致，但没有按 12.3 / 14.0 做运行时判断。已报在 [simular-ai/simulang-js#38](https://github.com/simular-ai/simulang-js/issues/38)。

## Linux

3.4.0 的 `linux-x64-gnu` 二进制用到了 **GLIBC 2.39**（符号 `GLIBC_2.39`）。这是 Ubuntu 24.04 的 glibc。Ubuntu 22.04（glibc 2.35）加载这个 `.node` 会失败。CI 在 `ubuntu-latest` 和 `ubuntu-24.04-arm` 上编译。

## Windows

README 和二进制都没有写系统版本下限。CI 只在 `windows-latest` 和 `windows-11-arm` 上编。

3.4.0 在 Windows 上还有这些和「系统版本号」无关、但这一版就没有实现的行为：

- `Instance.enableAccessibility()` 在 `simulib-rs/src/windows/instance.rs:100` 仍是 `todo!()`，调用会 panic：`not yet implemented`。macOS 上 Chrome 需要这个调用才打开无障碍树；Windows 上 UIA 客户端去读树时 Chrome 自己会打开，不要调用它。
- `App.open` 返回的 pid 经常不是拥有顶层窗口的那个进程。立刻 `AccessibilityTree.fromPid(launchPid)` 会抛 `No visible top-level window found for process …`。要改用真正拥有窗口的 pid。
- `App.defaultBrowser()` 的 `canonicalName` 和 `launchTarget` 可以是 `null`。
- Chrome 窗口标题经常是空的，或者不含 `Bing` / `必应`，不能用标题子串判断页面是否打开。

## 本项目里怎么绕开

- macOS 13 上跑探测时跳过截图：`node src/probe.mjs load apps windows files clipboard ax`。`npm run bing` 末尾的 `screenshotFull` 在 13 上同样会 abort。
- `src/bing-search.mjs` 只在 Darwin 上调用 `enableAccessibility()`。
- `src/browser-window.mjs` 的 `resolveBrowserPid()` 用来找真正拥有窗口的进程，`open-url.mjs` 和 `bing-search.mjs` 都用它。
