const ALARM_NAME = 'cron-tick';
const STORAGE_KEY = 'cron_logs';
const MAX_LOGS = 200;

let tasks = [];
let initialized = false;

async function loadTasks() {
  try {
    const resp = await fetch(chrome.runtime.getURL('src/tasks.json'));
    const data = await resp.json();
    tasks = data.tasks || [];
    console.log(`[Cron] Loaded ${tasks.length} task(s)`);
    return true;
  } catch (err) {
    console.error('[Cron] Failed to load tasks.json:', err);
    return false;
  }
}

function cronFieldMatches(pattern, value) {
  if (pattern === '*') return true;
  const parts = pattern.split(',');
  for (const part of parts) {
    if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const min = range === '*' ? 0 : parseInt(range.split('-')[0], 10);
      const max = range === '*' ? 59 : parseInt(range.split('-')[1] || range, 10);
      if (value >= min && value <= max && (value - min) % step === 0) return true;
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (value >= lo && value <= hi) return true;
    } else if (parseInt(part, 10) === value) {
      return true;
    }
  }
  return false;
}

function cronMatches(cronStr, date) {
  const fields = cronStr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [min, hour, dom, month, dow] = fields;
  return (
    cronFieldMatches(min, date.getMinutes()) &&
    cronFieldMatches(hour, date.getHours()) &&
    cronFieldMatches(dom, date.getDate()) &&
    cronFieldMatches(month, date.getMonth() + 1) &&
    cronFieldMatches(dow, date.getDay())
  );
}

async function addLog(entry) {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const logs = result[STORAGE_KEY] || [];
  logs.push({ ...entry, timestamp: new Date().toISOString() });
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  await chrome.storage.local.set({ [STORAGE_KEY]: logs });
}

async function executeTask(task) {
  const start = Date.now();
  let status = 'ok';
  let detail = '';

  try {
    switch (task.action) {
      case 'log':
        detail = task.config.message || 'tick';
        console.log(`[Cron:${task.id}] ${detail}`);
        break;

      case 'notify':
        await chrome.notifications.create(task.id, {
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon128.png'),
          title: task.config.title || task.name,
          message: task.config.message || '',
        });
        detail = 'notification sent';
        break;

      case 'fetch':
        {
          const resp = await fetch(task.config.url, {
            method: task.config.method || 'GET',
            headers: task.config.headers || {},
          });
          detail = `${resp.status} ${resp.statusText}`;
        }
        break;

      case 'script':
        {
          const fn = new Function(task.config.code);
          const result = await fn();
          detail = result !== undefined ? String(result) : 'ok';
        }
        break;

      default:
        status = 'error';
        detail = `unknown action: ${task.action}`;
    }
  } catch (err) {
    status = 'error';
    detail = err.message;
    console.error(`[Cron:${task.id}] Error:`, err);
  }

  await addLog({
    taskId: task.id,
    taskName: task.name,
    status,
    detail,
    duration: Date.now() - start,
  });
}

async function onTick() {
  const now = new Date();
  for (const task of tasks) {
    if (cronMatches(task.schedule, now)) {
      await executeTask(task);
    }
  }
}

async function setupAlarm() {
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  console.log('[Cron] Alarm registered (1-minute interval)');
}

async function initialize() {
  const ok = await loadTasks();
  if (ok) {
    await setupAlarm();
    initialized = true;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  initialize();
});

chrome.runtime.onStartup.addListener(() => {
  initialize();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME && initialized) {
    onTick();
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg.type) {
    case 'getTasks':
      sendResponse({ tasks });
      break;

    case 'getLogs':
      chrome.storage.local.get(STORAGE_KEY).then((result) => {
        sendResponse({ logs: result[STORAGE_KEY] || [] });
      });
      return true;

    case 'reloadConfig':
      loadTasks().then(() => sendResponse({ ok: true }));
      return true;

    case 'runTask':
      {
        const task = tasks.find((t) => t.id === msg.taskId);
        if (task) {
          executeTask(task).then(() => sendResponse({ ok: true }));
        } else {
          sendResponse({ ok: false, error: 'task not found' });
        }
      }
      return true;
  }
});