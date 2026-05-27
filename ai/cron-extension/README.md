# Personal Cron Tasks — Chrome Extension

Run cron-scheduled tasks while Chrome is active. No server, no accounts, no publishing. Just edit a JSON file.

## Quick Start

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `my-cron-extension/` folder
4. Click the extension icon to open the popup

## Configuration

Edit `src/tasks.json`:

```json
{
  "tasks": [
    {
      "id": "my-task",
      "name": "My Task",
      "schedule": "*/5 * * * *",
      "action": "notify",
      "config": { ... }
    }
  ]
}
```

### Schedule format

Standard 5-field cron: `minute hour day-of-month month day-of-week`

- `*` — every value
- `*/n` — every n units
- `1,3,5` — specific values
- `1-5` — ranges

### Actions

| Action | Config | What it does |
|--------|--------|-------------|
| `log` | `message` | Logs a message (useful for testing) |
| `notify` | `title`, `message` | Shows a Chrome notification |
| `fetch` | `url`, `method`, `headers` | Makes an HTTP request |
| `script` | `code` | Executes custom JS in the service worker |

After editing `tasks.json`, click **Reload Config** in the extension popup.

## Reload on config change

After editing `tasks.json`, click the **Reload Config** button in the popup, or go to `chrome://extensions` and click the reload icon on the extension card.