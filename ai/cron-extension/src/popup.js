let logsVisible = false;

async function refresh() {
  const tasksResp = await chrome.runtime.sendMessage({ type: 'getTasks' });
  const logsResp = await chrome.runtime.sendMessage({ type: 'getLogs' });

  renderTasks(tasksResp.tasks, logsResp.logs);
  renderLogs(logsResp.logs);
}

function renderTasks(tasks, logs) {
  const container = document.getElementById('taskList');

  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div class="empty-state">No tasks configured.<br>Edit <code>src/tasks.json</code> to get started.</div>';
    return;
  }

  const lastRunMap = {};
  for (const log of logs || []) {
    lastRunMap[log.taskId] = log;
  }

  container.innerHTML = tasks.map((task) => {
    const last = lastRunMap[task.id];
    const statusClass = last ? (last.status === 'ok' ? 'status-ok' : 'status-error') : '';
    const lastRun = last
      ? `<span class="${statusClass}">${new Date(last.timestamp).toLocaleTimeString()} — ${last.detail}</span>`
      : 'never run';

    return `
      <div class="task">
        <div class="task-header">
          <span class="task-name">${escHtml(task.name)}</span>
          <span class="task-schedule">${escHtml(task.schedule)}</span>
        </div>
        <div class="task-meta">Last: ${lastRun}</div>
        <div class="task-actions">
          <button class="run-btn" data-id="${escHtml(task.id)}">Run Now</button>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.run-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await chrome.runtime.sendMessage({ type: 'runTask', taskId: btn.dataset.id });
      refresh();
    });
  });
}

function renderLogs(logs) {
  const container = document.getElementById('logsContainer');
  if (!logs || logs.length === 0) {
    container.innerHTML = '<div class="empty-state">No logs yet.</div>';
    return;
  }

  container.innerHTML = logs.slice().reverse().slice(0, 50).map((log) => {
    const cls = log.status === 'ok' ? 'status-ok' : 'status-error';
    return `<div class="log-entry">[${new Date(log.timestamp).toLocaleTimeString()}] <span class="${cls}">${escHtml(log.taskName)}</span> — ${escHtml(log.detail)}</div>`;
  }).join('');
}

function escHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

document.getElementById('reloadBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'reloadConfig' });
  refresh();
});

document.getElementById('logsToggle').addEventListener('click', () => {
  logsVisible = !logsVisible;
  document.getElementById('logsContainer').classList.toggle('hidden', !logsVisible);
  document.getElementById('logsToggle').textContent = logsVisible ? 'Recent Logs ▾' : 'Recent Logs ▸';
});

refresh();