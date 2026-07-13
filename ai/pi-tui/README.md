# pi-tui Playground

An interactive demo showcasing all built-in components of [`@earendil-works/pi-tui`](https://github.com/earendil-works/pi) — a minimal terminal UI framework with differential rendering and synchronized output.

## Quick Start

```bash
pnpm install
pnpm start
# or: npx tsx playground.ts
```

## Components Showcase

| # | Section | Component | Description |
|---|---------|-----------|-------------|
| 1 | Welcome | — | Title bar with global keybinding reminder |
| 2 | Text | **Text** | Multi-line text with word wrapping, padding, and optional background color |
| 3 | TruncatedText | **TruncatedText** | Single-line text that truncates with `…` to fit the viewport |
| 4 | Markdown | **Markdown** | Renders **bold**, *italic*, `code`, blockquotes, lists, links, and code blocks |
| 5 | Box | **Box** | Container that adds padding and background color to children |
| 6 | **SelectList** | **SelectList** | Interactive selection list with `↑↓` navigation and descriptions |
| 7 | **SettingsList** | **SettingsList** | Settings panel with `Enter`/`Space` value cycling |
| 8 | **Loader** | **Loader** | Animated spinner with start/stop control |
| 9 | **Input** | **Input** | Single-line text input with horizontal scrolling |
| 10 | **Editor** | **Editor** | Multi-line editor with autocomplete, paste handling, and slash commands |

> Sections 6–10 are interactive. Each section's title shows its keybinding hint (e.g. `Ctrl+1 / Tab ↻`), and a detailed tip line appears below the component.

## Controls

### Global

| Key | Action |
|-----|--------|
| `Tab` | Cycle focus forward (not in Editor — Editor uses Tab for autocomplete) |
| `Ctrl+1` | Jump to SelectList |
| `Ctrl+2` | Jump to SettingsList |
| `Ctrl+3` | Jump to Input |
| `Ctrl+4` | Jump to Editor |
| `Ctrl+5` | Jump to Loader (auto-triggers spinner) |
| `Ctrl+C` | Exit |

### Per-component

| Component | Controls |
|-----------|----------|
| SelectList | `↑↓` navigate, `Enter` select, `Esc` back to Editor |
| SettingsList | `↑↓` navigate, `Enter`/`Space` cycle value, `Esc` back to Editor |
| Input | Type text, `Enter` submit, `Esc` back to Editor |
| Editor | Type text, `Tab` autocomplete (`/` for slash commands), `Enter` submit, `/clear` reset |
| Loader | Auto-triggers on focus, stops after 3s |

## Architecture Notes

The TUI renders all components linearly into the terminal's scrollback buffer. There is no virtual overflow or scroll container — content exceeding the terminal height scrolls naturally via the terminal's native scrollback. The TUI uses **differential rendering** (three strategies) with **CSI 2026 synchronized output** for flicker-free updates.