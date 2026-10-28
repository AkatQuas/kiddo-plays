// Page behaviour for file share and text share. Templates only provide markup.

let currentText = '';

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-action]');
  if (!trigger || !actions[trigger.dataset.action]) {
    return;
  }
  event.preventDefault();
  actions[trigger.dataset.action](trigger);
});

document.addEventListener('DOMContentLoaded', () => {
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (event) => {
      event.preventDefault();
      uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () =>
      uploadArea.classList.remove('dragover')
    );
    uploadArea.addEventListener('drop', (event) => {
      event.preventDefault();
      uploadArea.classList.remove('dragover');
      uploadFileList(event.dataTransfer.files);
    });
    uploadArea.addEventListener('click', (event) => {
      if (event.target.closest('button, select, a, input, label, .upload-category')) {
        return;
      }
      document.getElementById('fileInput').click();
    });
  }

  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      uploadFileList(fileInput.files);
      fileInput.value = '';
    });
  }

  const fileSearch = document.getElementById('fileSearchInput');
  if (fileSearch) {
    fileSearch.addEventListener('input', applyFileFilter);
  }
  const categoryFilter = document.getElementById('categoryFilter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFileFilter);
  }
  const textSearch = document.getElementById('textSearchInput');
  if (textSearch) {
    textSearch.addEventListener('input', applyTextFilter);
  }

  document
    .querySelectorAll("#mainTabs [data-bs-toggle='tab']")
    .forEach((button) => {
      button.addEventListener('shown.bs.tab', () => {
        const target = button.getAttribute('data-bs-target');
        history.replaceState(
          null,
          '',
          target === '#texts' ? '#texts' : '#files'
        );
      });
    });

  if (location.hash === '#texts' && document.getElementById('texts-tab')) {
    bootstrap.Tab.getOrCreateInstance(
      document.getElementById('texts-tab')
    ).show();
  }

  document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((node) => {
    new bootstrap.Tooltip(node);
  });

  const flashed = readFlash();
  if (flashed) {
    showSuccess(flashed);
  }

  loadCategories();
  loadShareAddress();
});

const actions = {
  'pick-files': () => document.getElementById('fileInput').click(),
  'upload-files': () => uploadFiles(),
  'refresh-files': (button) => refreshFiles(button),
  'clear-files': () => clearFiles(),
  'checksum-all': () => checksumAll(),
  'checksum-file': (button) => checksumFile(button.dataset.fileName),
  'clear-file-search': () => {
    document.getElementById('fileSearchInput').value = '';
    applyFileFilter();
  },
  'delete-file': (button) => deleteFile(button.dataset.fileName),
  'copy-md5': (button) =>
    copyPlain(button.dataset.md5, 'MD5值已复制到剪贴板！'),
  'change-category': (button) =>
    openFileCategory(button.dataset.fileName, button.dataset.fileCategory),
  'confirm-file-category': () => confirmFileCategory(),
  'show-categories': () => showCategories(),
  'create-category': () => createCategory(),
  'confirm-edit-category': () => confirmEditCategory(),
  'create-text': () => createText(),
  'refresh-texts': (button) => refreshTexts(button),
  'clear-texts': () => clearTexts(),
  'clear-text-search': () => {
    document.getElementById('textSearchInput').value = '';
    applyTextFilter();
  },
  'copy-text-item': (button) => copyTextItem(button),
  'edit-text': (button) => editText(button),
  'delete-text': (button) => deleteText(button.dataset.textId),
  'update-text': () => updateText(),
  'copy-text': () => copyText(),
  'copy-share-url': () => copyShareUrl(),
  'refresh-visitor': (button) => refreshVisitor(button),
};

async function uploadFileList(fileList) {
  if (!fileList || fileList.length === 0) {
    return;
  }
  const files = fileList;

  const formData = new FormData();
  for (const file of files) {
    formData.append('file', file);
  }
  const category = document.getElementById('uploadCategory');
  formData.append('category', category ? category.value : '未分类');

  const bar = document.getElementById('uploadProgress');
  bar.style.width = '0%';
  bar.classList.remove('bg-success', 'bg-danger');
  document.getElementById('uploadStatus').textContent = '正在上传...';
  bootstrap.Toast.getOrCreateInstance(
    document.getElementById('uploadToast')
  ).show();

  try {
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.message || data.error || '上传失败');
    }
    document.getElementById('uploadStatus').textContent =
      data.message || '上传成功！';
    bar.style.width = '100%';
    bar.classList.add('bg-success');
    const uploadToast = bootstrap.Toast.getInstance(
      document.getElementById('uploadToast')
    );
    if (uploadToast) {
      uploadToast.hide();
    }
    showSuccess(data.message || '上传成功！');
    await refreshFiles();
  } catch (error) {
    document.getElementById('uploadStatus').textContent =
      '上传失败：' + error.message;
    bar.classList.add('bg-danger');
  }
}

async function deleteFile(name) {
  if (!confirm(`确定要删除文件 "${name}" 吗？`)) {
    return;
  }
  const response = await fetch('/delete/' + encodeURIComponent(name));
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    alert('删除失败：' + (data.error || response.status));
    return;
  }
  await refreshFiles();
}

async function clearFiles() {
  if (!confirm('确定要删除所有文件吗？此操作不可恢复！')) {
    return;
  }
  try {
    await sendJson('/api/files/clear', 'DELETE');
    await refreshFiles();
  } catch (error) {
    alert(error.message);
  }
}

async function checksumAll() {
  if (!confirm('确定要为所有文件计算MD5值吗？这可能需要一些时间...')) {
    return;
  }
  await mutate('/api/files/calculate-md5', 'POST');
}

async function checksumFile(name) {
  if (!confirm(`确定要为文件 "${name}" 计算MD5值吗？`)) {
    return;
  }
  await mutate(
    '/api/files/' + encodeURIComponent(name) + '/md5',
    'POST',
    'MD5值计算成功！'
  );
}

function applyFileFilter() {
  const term = valueOf('fileSearchInput').toLowerCase();
  const category = document.getElementById('categoryFilter')
    ? document.getElementById('categoryFilter').value
    : '';
  const rows = document.querySelectorAll('#fileList .file-item');
  let matches = 0;
  rows.forEach((row) => {
    const nameNode = row.querySelector('.file-name');
    const name = (nameNode ? nameNode.textContent : '').toLowerCase();
    const badge = row.querySelector('.badge');
    const fileCategory = badge ? badge.textContent.trim() : '';
    const visible =
      (!term || name.includes(term)) &&
      (!category || fileCategory === category);
    row.hidden = !visible;
    if (visible) {
      matches += 1;
    }
  });
  if (!term && !category) {
    removeNote('searchResultInfo');
    return;
  }
  showNote('searchResultInfo', 'fileSearchInput', matches, rows.length, '文件');
}

async function refreshFiles(button) {
  await withRefresh(button, async () => {
    const response = await fetch('/api/files');
    const files = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(files)) {
      throw new Error((files && files.error) || '刷新文件失败');
    }
    renderFileList(files);
    await loadCategories();
    applyFileFilter();
  });
}

async function refreshTexts(button) {
  await withRefresh(button, async () => {
    const response = await fetch('/api/texts');
    const texts = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(texts)) {
      throw new Error((texts && texts.error) || '刷新文本失败');
    }
    renderTextList(texts);
    applyTextFilter();
  });
}

async function withRefresh(button, task) {
  if (button) {
    button.disabled = true;
  }
  try {
    await task();
  } catch (error) {
    alert(error.message);
  } finally {
    if (button) {
      button.disabled = false;
    }
  }
}

function renderFileList(files) {
  const list = document.getElementById('fileList');
  if (!list) {
    return;
  }
  if (!files.length) {
    list.replaceChildren(emptyState('bi bi-folder-x', '暂无文件'));
    return;
  }
  const fragment = document.createDocumentFragment();
  files.forEach((file) => fragment.append(fileItem(file)));
  list.replaceChildren(fragment);
}

function fileItem(file) {
  const column = el('div', 'col file-item');
  const card = el('div', 'card h-100');
  const body = el('div', 'card-body file-card-body d-flex align-items-start gap-3');
  const info = el('div', 'file-card-info');
  info.append(el('div', 'file-name fw-medium', file.original_name || file.name));
  const meta = el('div', 'text-muted small mt-2');
  meta.append(
    document.createTextNode(file.size_human || ''),
    el('span', 'mx-1', '·'),
    document.createTextNode(file.modified || '')
  );
  const categoryRow = el('div', 'mt-2 d-flex align-items-center gap-1');
  categoryRow.append(el('span', 'badge bg-secondary', file.category || '未分类'));
  const change = iconButton('bi bi-pencil', '修改分类');
  change.dataset.action = 'change-category';
  change.dataset.fileName = file.name;
  change.dataset.fileCategory = file.category || '未分类';
  categoryRow.append(change);
  const checksum = el('div', 'file-md5 small mt-2 d-flex align-items-center gap-1');
  if (file.md5) {
    checksum.append(el('span', 'text-muted', 'MD5'), el('code', null, file.md5));
    const copy = iconButton('bi bi-clipboard', '复制');
    copy.dataset.action = 'copy-md5';
    copy.dataset.md5 = file.md5;
    checksum.append(copy);
  } else {
    checksum.append(el('span', 'text-muted', 'MD5 未计算'));
    const calculate = iconButton('bi bi-calculator', '计算');
    calculate.dataset.action = 'checksum-file';
    calculate.dataset.fileName = file.name;
    checksum.append(calculate);
  }
  info.append(meta, categoryRow, checksum);
  const actions = el('div', 'file-card-actions d-flex flex-column gap-2');
  const download = el('a', 'btn btn-outline-primary btn-sm');
  download.href = '/download/' + encodeURIComponent(file.name);
  download.setAttribute('aria-label', '下载');
  download.title = '下载';
  download.append(el('i', 'bi bi-download'));
  const remove = el('button', 'btn btn-outline-danger btn-sm');
  remove.type = 'button';
  remove.setAttribute('aria-label', '删除');
  remove.title = '删除';
  remove.dataset.action = 'delete-file';
  remove.dataset.fileName = file.name;
  remove.append(el('i', 'bi bi-trash'));
  actions.append(download, remove);
  body.append(info, actions);
  card.append(body);
  column.append(card);
  return column;
}

function iconButton(icon, label) {
  const button = el('button', 'icon-btn');
  button.type = 'button';
  button.setAttribute('aria-label', label);
  button.title = label;
  button.append(el('i', icon));
  return button;
}

function renderTextList(texts) {
  const list = document.getElementById('textList');
  if (!list) {
    return;
  }
  if (!texts.length) {
    list.replaceChildren(emptyState('bi bi-text-paragraph', '暂无文本'));
    return;
  }
  const fragment = document.createDocumentFragment();
  texts.forEach((text) => fragment.append(textItem(text)));
  list.replaceChildren(fragment);
}

function textItem(text) {
  const column = el('div', 'col text-item');
  const card = el('div', 'card h-100');
  const body = el('div', 'card-body');
  body.append(
    el('p', 'text-excerpt text-muted small mb-2', excerpt(text.content)),
    el('small', 'text-muted', text.created || '')
  );
  const footer = el('div', 'card-footer bg-transparent d-flex gap-2');
  const copy = el('button', 'btn btn-outline-primary btn-sm', '复制');
  copy.type = 'button';
  copy.dataset.action = 'copy-text-item';
  copy.dataset.textId = text.id;
  const edit = el('button', 'btn btn-outline-secondary btn-sm', '编辑');
  edit.type = 'button';
  edit.dataset.action = 'edit-text';
  edit.dataset.textId = text.id;
  const remove = el('button', 'btn btn-outline-danger btn-sm', '删除');
  remove.type = 'button';
  remove.dataset.action = 'delete-text';
  remove.dataset.textId = text.id;
  footer.append(copy, edit, remove);
  card.append(body, footer);
  column.append(card);
  return column;
}

function excerpt(content) {
  const value = content || '';
  return value.length > 100 ? value.slice(0, 100) + '...' : value;
}

function emptyState(iconClass, title) {
  const box = el('div', 'col-12 list-empty text-center text-muted py-4');
  box.append(el('i', iconClass + ' display-4'), el('h6', 'mt-3', title));
  return box;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

async function loadCategories() {
  if (!document.getElementById('uploadCategory')) {
    return;
  }
  try {
    const response = await fetch('/api/categories');
    const categories = await response.json();
    fillSelect(document.getElementById('uploadCategory'), categories, false);
    fillSelect(document.getElementById('categoryFilter'), categories, true);
    fillSelect(
      document.getElementById('changeCategorySelect'),
      categories,
      false
    );
  } catch (error) {
    console.error('加载分类失败:', error);
  }
}

function fillSelect(select, categories, includeAll) {
  if (!select) {
    return;
  }
  const current = select.value;
  select.replaceChildren();
  if (includeAll) {
    select.append(new Option('所有分类', ''));
  }
  select.append(new Option('未分类', '未分类'));
  categories.forEach((category) =>
    select.append(new Option(category.name, category.name))
  );
  if ([...select.options].some((option) => option.value === current)) {
    select.value = current;
  }
}

function showCategories() {
  renderCategoryList();
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById('categoryModal')
  ).show();
}

async function renderCategoryList() {
  const response = await fetch('/api/categories');
  const categories = await response.json();
  const list = document.getElementById('categoryList');
  list.replaceChildren();

  const fallback = document.createElement('div');
  fallback.className =
    'd-flex justify-content-between align-items-center mb-2 p-2 border rounded';
  const badge = document.createElement('span');
  badge.className = 'badge bg-secondary';
  badge.textContent = '未分类';
  const hint = document.createElement('small');
  hint.className = 'text-muted';
  hint.textContent = '系统默认分类';
  fallback.append(badge, hint);
  list.append(fallback);

  categories.forEach((category) => {
    const row = document.createElement('div');
    row.className =
      'd-flex justify-content-between align-items-center mb-2 p-2 border rounded';
    const label = document.createElement('div');
    const name = document.createElement('span');
    name.className = 'badge bg-primary';
    name.textContent = category.name;
    const created = document.createElement('small');
    created.className = 'text-muted ms-2';
    created.textContent = '创建于: ' + category.created;
    label.append(name, created);

    const buttons = document.createElement('div');
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'btn btn-outline-secondary btn-sm me-1';
    edit.innerHTML = '<i class="bi bi-pencil"></i>';
    edit.addEventListener('click', () =>
      openEditCategory(category.id, category.name)
    );
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'btn btn-outline-danger btn-sm';
    remove.innerHTML = '<i class="bi bi-trash"></i>';
    remove.addEventListener('click', () =>
      removeCategory(category.id, category.name)
    );
    buttons.append(edit, remove);
    row.append(label, buttons);
    list.append(row);
  });
}

async function createCategory() {
  const input = document.getElementById('newCategoryName');
  const name = input.value.trim();
  if (!name) {
    alert('请输入分类名称');
    return;
  }
  try {
    const data = await sendJson('/api/categories', 'POST', { name });
    showSuccess(data.message);
    input.value = '';
    await loadCategories();
    await renderCategoryList();
  } catch (error) {
    alert('创建分类失败：' + error.message);
  }
}

function openEditCategory(id, name) {
  document.getElementById('editCategoryModal').dataset.categoryId = id;
  document.getElementById('editCategoryName').value = name;
  bootstrap.Modal.getOrCreateInstance(
    document.getElementById('editCategoryModal')
  ).show();
}

async function confirmEditCategory() {
  const id = document.getElementById('editCategoryModal').dataset.categoryId;
  const name = document.getElementById('editCategoryName').value.trim();
  if (!name) {
    alert('请输入分类名称');
    return;
  }
  try {
    const data = await sendJson(
      '/api/categories/' + encodeURIComponent(id),
      'PUT',
      { name }
    );
    flash(data.message);
  } catch (error) {
    alert('更新分类失败：' + error.message);
  }
}

async function removeCategory(id, name) {
  if (!confirm(`确定要删除分类"${name}"吗？`)) {
    return;
  }
  try {
    const data = await sendJson(
      '/api/categories/' + encodeURIComponent(id),
      'DELETE'
    );
    showSuccess(data.message);
    await loadCategories();
    await renderCategoryList();
  } catch (error) {
    alert('删除分类失败：' + error.message);
  }
}

function openFileCategory(name, category) {
  const modal = document.getElementById('changeCategoryModal');
  modal.dataset.fileName = name;
  const select = document.getElementById('changeCategorySelect');
  select.value = category || '未分类';
  bootstrap.Modal.getOrCreateInstance(modal).show();
}

async function confirmFileCategory() {
  const modal = document.getElementById('changeCategoryModal');
  const name = modal.dataset.fileName;
  const category = document.getElementById('changeCategorySelect').value;
  try {
    const data = await sendJson(
      '/api/files/' + encodeURIComponent(name) + '/category',
      'PUT',
      { category }
    );
    flash(data.message || '文件分类更新成功');
  } catch (error) {
    alert('修改分类失败：' + error.message);
  }
}

async function createText() {
  const content = document.getElementById('textContent').value.trim();
  if (!content) {
    alert('请填写内容');
    return;
  }
  try {
    await sendJson('/api/text', 'POST', { content });
    document.getElementById('createTextForm').reset();
    showSuccess('文本创建成功！');
    await refreshTexts();
  } catch (error) {
    alert('创建失败：' + error.message);
  }
}

async function copyTextItem(button) {
  try {
    const text = await loadText(button.dataset.textId);
    currentText = text.content;
    await copyText();
  } catch (error) {
    alert('复制失败：' + error.message);
  }
}

async function viewText(button) {
  try {
    const text = await loadText(button.dataset.textId);
    currentText = text.content;
    document.getElementById('viewContent').textContent = text.content;
    bootstrap.Modal.getOrCreateInstance(
      document.getElementById('viewTextModal')
    ).show();
  } catch (error) {
    alert('读取文本失败：' + error.message);
  }
}

async function editText(button) {
  try {
    const text = await loadText(button.dataset.textId);
    document.getElementById('editTextId').value = text.id;
    document.getElementById('editTextContent').value = text.content;
    bootstrap.Modal.getOrCreateInstance(
      document.getElementById('editTextModal')
    ).show();
  } catch (error) {
    alert('读取文本失败：' + error.message);
  }
}

async function loadText(id) {
  const response = await fetch('/api/text/' + encodeURIComponent(id));
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || '文本不存在');
  }
  return data;
}

async function updateText() {
  const id = document.getElementById('editTextId').value;
  const content = document.getElementById('editTextContent').value.trim();
  if (!content) {
    alert('请填写内容');
    return;
  }
  try {
    await sendJson('/api/text/' + encodeURIComponent(id), 'PUT', { content });
    const editModal = bootstrap.Modal.getInstance(document.getElementById('editTextModal'));
    if (editModal) {
      editModal.hide();
    }
    showSuccess('文本更新成功！');
    await refreshTexts();
  } catch (error) {
    alert('更新失败：' + error.message);
  }
}

async function deleteText(id) {
  if (!confirm('确定要删除这条文本吗？')) {
    return;
  }
  try {
    await sendJson('/api/text/' + encodeURIComponent(id), 'DELETE');
    await refreshTexts();
  } catch (error) {
    alert('删除失败：' + error.message);
  }
}

async function clearTexts() {
  if (!confirm('确定要删除所有文本吗？此操作不可恢复！')) {
    return;
  }
  try {
    await sendJson('/api/texts/clear', 'DELETE');
    await refreshTexts();
  } catch (error) {
    alert('删除失败：' + error.message);
  }
}

function applyTextFilter() {
  const term = valueOf('textSearchInput').toLowerCase();
  const cards = document.querySelectorAll('#textList .text-item');
  let matches = 0;
  cards.forEach((card) => {
    const excerptNode = card.querySelector('.text-excerpt');
    const content = (excerptNode ? excerptNode.textContent : '').toLowerCase();
    const visible = !term || content.includes(term);
    card.hidden = !visible;
    if (visible) {
      matches += 1;
    }
  });
  if (!term) {
    removeNote('textSearchResultInfo');
    return;
  }
  showNote(
    'textSearchResultInfo',
    'textSearchInput',
    matches,
    cards.length,
    '文本'
  );
}

async function copyText() {
  if (!currentText) {
    showError('没有可复制的内容');
    return;
  }
  const html = escapeHtml(currentText).replace(/\n/g, '<br>');
  try {
    if (navigator.clipboard && window.isSecureContext && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([currentText], { type: 'text/plain' }),
        }),
      ]);
      showSuccess('文本内容已复制到剪贴板！');
      return;
    }
  } catch (error) {
    console.error('HTML复制失败，尝试纯文本复制:', error);
  }
  await copyPlain(currentText, '文本内容已复制到剪贴板！');
}

async function copyPlain(text, successMessage) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      showSuccess(successMessage);
      return;
    }
  } catch (error) {
    console.error('复制失败:', error);
  }
  try {
    fallbackCopy(text);
    showSuccess(successMessage);
  } catch (_error) {
    alert('复制失败，请手动复制');
  }
}

function fallbackCopy(text) {
  const area = document.createElement('textarea');
  area.value = text;
  area.style.position = 'fixed';
  area.style.left = '-9999px';
  document.body.appendChild(area);
  area.focus();
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  if (!copied) {
    throw new Error('copy failed');
  }
}

async function loadShareAddress() {
  const node = document.getElementById('shareUrl');
  if (!node) {
    return;
  }
  const fallbackPort = document.body.dataset.port || '';
  try {
    const response = await fetch('/api/network-info');
    const data = await response.json();
    const port = data.port || fallbackPort;
    node.textContent = 'http://' + data.ip + ':' + port;
  } catch (_error) {
    node.textContent = 'http://localhost:' + fallbackPort;
  }
}

function copyShareUrl() {
  const node = document.getElementById('shareUrl');
  const url = node ? node.textContent.trim() : '';
  if (!url.startsWith('http')) {
    alert('地址还没准备好');
    return;
  }
  copyPlain(url, '地址已复制');
}

async function loadVisitor() {
  const visitor = document.getElementById('visitorIP');
  if (!visitor) {
    return;
  }
  visitor.textContent = '本地访问';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch('/api/network-info', {
      signal: controller.signal,
    });
    const data = await response.json();
    if (
      !data.visitor_ip ||
      data.visitor_ip === '127.0.0.1' ||
      data.visitor_ip === 'localhost'
    ) {
      visitor.textContent = '本地访问';
    } else {
      visitor.textContent = data.visitor_ip;
    }
  } catch (_error) {
    visitor.textContent = '本地访问';
  } finally {
    clearTimeout(timer);
  }
}

async function refreshVisitor(button) {
  const icon = button.querySelector('i');
  button.disabled = true;
  if (icon) {
    icon.classList.add('spin');
  }
  await loadVisitor();
  button.disabled = false;
  if (icon) {
    icon.classList.remove('spin');
  }
}

async function mutate(url, method, successMessage) {
  try {
    const data = await sendJson(url, method);
    flash(successMessage || data.message);
  } catch (error) {
    alert(error.message);
  }
}

function flash(message) {
  try {
    sessionStorage.setItem('share-flash', message);
  } catch (_error) {
    // 隐私模式可能禁用 sessionStorage，刷新本身仍然是结果。
  }
  reloadKeepingTab();
}

function readFlash() {
  try {
    const message = sessionStorage.getItem('share-flash');
    if (message) {
      sessionStorage.removeItem('share-flash');
    }
    return message || '';
  } catch (_error) {
    return '';
  }
}

async function sendJson(url, method, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    throw new Error(data.error || data.message || '请求失败');
  }
  return data;
}

function reloadKeepingTab() {
  if (document.getElementById('texts-tab')) {
    const texts = document.getElementById('texts');
    const onTexts = texts && texts.classList.contains('active');
    history.replaceState(null, '', onTexts ? '#texts' : '#files');
  }
  location.reload();
}

function showSuccess(message) {
  const node = document.getElementById('successMessage');
  if (!node) {
    return;
  }
  node.textContent = message;
  bootstrap.Toast.getOrCreateInstance(
    document.getElementById('successToast')
  ).show();
}

function showError(message) {
  const toast = document.createElement('div');
  toast.className = 'toast show';
  toast.setAttribute('role', 'alert');
  const header = document.createElement('div');
  header.className = 'toast-header bg-danger text-white';
  header.textContent = '错误';
  const body = document.createElement('div');
  body.className = 'toast-body';
  body.textContent = message;
  toast.append(header, body);
  document.querySelector('.toast-container').append(toast);
  setTimeout(() => toast.remove(), 3000);
}

function showNote(id, inputId, matches, total, label) {
  let note = document.getElementById(id);
  if (!note) {
    note = document.createElement('div');
    note.id = id;
    note.className = 'alert alert-sm mt-2 mb-0';
    document.getElementById(inputId).closest('.row').append(note);
  }
  note.className =
    'alert alert-sm mt-2 mb-0 ' +
    (matches === 0 ? 'alert-warning' : 'alert-info');
  note.textContent =
    matches === 0
      ? '未找到匹配的' + label
      : `找到 ${matches} 个${label}（共 ${total} 个）`;
}

function removeNote(id) {
  const note = document.getElementById(id);
  if (note) {
    note.remove();
  }
}

function valueOf(id) {
  const node = document.getElementById(id);
  return node ? node.value.trim() : '';
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
