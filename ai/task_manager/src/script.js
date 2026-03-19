// Task Manager JavaScript
class TaskManager {
  constructor() {
    this.tasks = this.loadTasks();
    this.taskForm = document.getElementById('add-task-form');
    this.taskInput = document.getElementById('task-input');
    this.tasksList = document.getElementById('tasks');
    this.filterButtons = document.querySelectorAll('.filter-btn');
    this.currentFilter = 'all';
    this.editingTaskId = null;
    this.selectedTasks = new Set();

    this.jsonButton = document.getElementById('edit-json-btn');
    this.jsonModal = document.getElementById('json-modal');
    this.tasksJsonTextarea = document.getElementById('tasks-json');
    this.saveJsonBtn = document.getElementById('save-json');
    this.cancelJsonBtn = document.getElementById('cancel-json');
    this.modalCloseBtn = this.jsonModal.querySelector('.modal-close');
    this.modalOverlay = this.jsonModal.querySelector('.modal-overlay');

    this.batchActions = document.getElementById('batch-actions');
    this.batchCompleteBtn = document.getElementById('batch-complete');
    this.batchHideBtn = document.getElementById('batch-hide');
    this.batchUnhideBtn = document.getElementById('batch-unhide');
    this.batchDeleteBtn = document.getElementById('batch-delete');

    this.init();
  }

  loadTasks() {
    const raw = localStorage.getItem('tasks');
    const tasks = raw ? JSON.parse(raw) : [];

    return tasks.map((task) => ({
      id: String(task.id || Date.now()),
      text: String(task.text || ''),
      completed: Boolean(task.completed),
      completedAt: task.completedAt || null,
      hidden: Boolean(task.hidden),
      createdAt: task.createdAt || task.id || new Date().toISOString()
    }));
  }

  init() {
    this.renderTasks();
    this.bindEvents();
  }

  bindEvents() {
    this.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.addTask();
    });

    this.tasksList.addEventListener('click', (e) => {
      const id = e.target.dataset.id;
      if (!id) return;

      if (e.target.classList.contains('complete-btn')) {
        this.completeTask(id);
      } else if (e.target.classList.contains('copy-btn')) {
        this.copyTask(id);
      } else if (e.target.classList.contains('hide-btn')) {
        this.hideTask(id);
      } else if (e.target.classList.contains('delete-btn')) {
        this.deleteTask(id);
      } else if (e.target.classList.contains('edit-btn')) {
        this.startEditing(id);
      } else if (e.target.classList.contains('unhide-btn')) {
        this.unhideTask(id);
      }
    });

    this.tasksList.addEventListener('change', (e) => {
      if (e.target.type === 'checkbox') {
        const id = e.target.dataset.id;
        if (id) {
          this.toggleSelection(id);
        }
      }
    });

    this.tasksList.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('edit-input')) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        this.commitEdit(e.target.dataset.id, e.target.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelEdit();
      }
    });

    this.tasksList.addEventListener('focusout', (e) => {
      if (!e.target.classList.contains('edit-input')) return;
      this.commitEdit(e.target.dataset.id, e.target.value);
    });

    this.filterButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        this.setFilter(e.target.dataset.filter);
      });
    });

    this.jsonButton.addEventListener('click', () => this.openJsonModal());
    this.cancelJsonBtn.addEventListener('click', () => this.closeJsonModal());
    this.modalCloseBtn.addEventListener('click', () => this.closeJsonModal());
    this.modalOverlay.addEventListener('click', () => this.closeJsonModal());
    this.saveJsonBtn.addEventListener('click', () => this.saveJsonEdits());

    this.batchCompleteBtn.addEventListener('click', () => this.batchComplete());
    this.batchHideBtn.addEventListener('click', () => this.batchHide());
    this.batchUnhideBtn.addEventListener('click', () => this.batchUnhide());
    this.batchDeleteBtn.addEventListener('click', () => this.batchDelete());
  }

  addTask() {
    const taskText = this.taskInput.value.trim();
    if (taskText === '') return;

    const task = {
      id: Date.now().toString(),
      text: taskText,
      completed: false,
      completedAt: null,
      hidden: false,
      createdAt: new Date().toISOString()
    };

    this.tasks.push(task);
    this.saveTasks();
    this.renderTasks();
    this.taskInput.value = '';
    this.taskInput.focus();
  }

  completeTask(id) {
    const task = this.tasks.find((task) => task.id === id);
    if (!task || task.completed) return;

    task.completed = true;
    task.completedAt = new Date().toISOString();
    this.saveTasks();
    this.renderTasks();
  }

  copyTask(id) {
    const original = this.tasks.find((task) => task.id === id);
    if (!original) return;

    const newTask = {
      id: Date.now().toString(),
      text: `${original.text} (copy)`,
      completed: false,
      completedAt: null,
      hidden: false,
      createdAt: new Date().toISOString()
    };

    this.tasks.push(newTask);
    this.saveTasks();
    this.renderTasks();
  }

  hideTask(id) {
    const task = this.tasks.find((task) => task.id === id);
    if (!task) return;

    task.hidden = true;
    this.saveTasks();
    this.renderTasks();
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter((task) => task.id !== id);
    this.saveTasks();
    this.renderTasks();
  }

  startEditing(id) {
    this.editingTaskId = id;
    this.renderTasks();

    const input = this.tasksList.querySelector(`.edit-input[data-id="${id}"]`);
    if (input) input.focus();
  }

  commitEdit(id, value) {
    const task = this.tasks.find((task) => task.id === id);
    if (!task) {
      this.cancelEdit();
      return;
    }

    const nextText = String(value || '').trim();
    if (nextText === '') {
      this.cancelEdit();
      return;
    }

    task.text = nextText;
    this.saveTasks();
    this.cancelEdit();
    this.renderTasks();
  }

  cancelEdit() {
    this.editingTaskId = null;
    this.renderTasks();
  }

  setFilter(filter) {
    this.currentFilter = filter;
    this.filterButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    this.renderTasks();
  }

  saveTasks() {
    localStorage.setItem('tasks', JSON.stringify(this.tasks));
  }

  formatCompletionTime(completedAt) {
    if (!completedAt) return '';

    const completedDate = new Date(completedAt);
    const now = new Date();

    const diffMs = now - completedDate;
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays === 0) {
      if (diffHours === 0) {
        return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
      }
      return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
    }

    const sameYear = completedDate.getFullYear() === now.getFullYear();
    const options = {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };

    if (sameYear) {
      return completedDate.toLocaleDateString('en-US', options);
    }

    return completedDate.toLocaleDateString('en-US', {
      year: 'numeric',
      ...options
    });
  }

  getFilteredTasks() {
    const visible = this.tasks.filter((task) => !task.hidden);
    const pending = visible
      .filter((t) => !t.completed)
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    const completed = visible
      .filter((t) => t.completed)
      .sort((a, b) => {
        const aTime = a.completedAt ? Date.parse(a.completedAt) : 0;
        const bTime = b.completedAt ? Date.parse(b.completedAt) : 0;
        return bTime - aTime;
      });

    if (this.currentFilter === 'pending') return pending;
    if (this.currentFilter === 'completed') return completed;
    return [...pending, ...completed];
  }

  openJsonModal() {
    this.tasksJsonTextarea.value = JSON.stringify(this.tasks, null, 2);
    this.jsonModal.classList.add('open');
    this.jsonModal.setAttribute('aria-hidden', 'false');
    this.tasksJsonTextarea.focus();
  }

  closeJsonModal() {
    this.jsonModal.classList.remove('open');
    this.jsonModal.setAttribute('aria-hidden', 'true');
  }

  saveJsonEdits() {
    try {
      const parsed = JSON.parse(this.tasksJsonTextarea.value);
      if (!Array.isArray(parsed))
        throw new Error('JSON must be an array of tasks.');

      this.tasks = parsed.map((task) => ({
        id: String(task.id || Date.now()),
        text: String(task.text || ''),
        completed: Boolean(task.completed),
        completedAt: task.completedAt || null,
        hidden: Boolean(task.hidden),
        createdAt: task.createdAt || new Date().toISOString()
      }));

      this.saveTasks();
      this.closeJsonModal();
      this.renderTasks();
    } catch (error) {
      alert(`Unable to parse tasks JSON: ${error.message}`);
    }
  }

  renderTasks() {
    const filteredTasks = this.getFilteredTasks();
    this.tasksList.innerHTML = '';

    if (filteredTasks.length === 0) {
      const emptyMessage = document.createElement('li');
      const messages = {
        all: 'No tasks yet. Add one above!',
        completed: 'No completed tasks yet.',
        pending: 'No pending tasks.'
      };
      emptyMessage.innerHTML = `<p style="text-align: center; color: #6c757d; font-style: italic;">${messages[this.currentFilter]}</p>`;
      this.tasksList.appendChild(emptyMessage);
      return;
    }

    filteredTasks.forEach((task) => {
      const li = document.createElement('li');
      const completionText = task.completed
        ? this.formatCompletionTime(task.completedAt)
        : '';
      const completionLabel = completionText
        ? `<span class="completion-time">${completionText}</span>`
        : '';

      const isEditing = this.editingTaskId === task.id;
      const taskDisplay = isEditing
        ? `<input class="edit-input" data-id="${task.id}" value="${this.escapeHtml(task.text)}" aria-label="Edit task" />`
        : `<span class="task-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</span>`;

      const actions = [];
      if (!task.completed) {
        actions.push(
          `<button class="complete-btn" data-id="${task.id}" aria-label="Mark as complete">✅</button>`
        );
        actions.push(
          `<button class="edit-btn" data-id="${task.id}" aria-label="Edit task">✏️</button>`
        );
        actions.push(
          `<button class="delete-btn" data-id="${task.id}" aria-label="Delete task">🗑️</button>`
        );
      } else {
        actions.push(
          `<button class="copy-btn" data-id="${task.id}" aria-label="Copy task">📋</button>`
        );
        actions.push(
          `<button class="hide-btn" data-id="${task.id}" aria-label="Hide task">🙈</button>`
        );
      }

      li.innerHTML = `
        <div class="task-content">
          <input type="checkbox" ${task.completed ? 'checked disabled' : ''} aria-label="Mark task as complete" ${task.completed ? 'disabled' : ''} />
          ${taskDisplay}
          ${completionLabel}
        </div>
        <div class="task-actions">
          ${actions.join('')}
        </div>
      `;

      this.tasksList.appendChild(li);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the task manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TaskManager();
});
