/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/application-architecture#main-and-renderer-processes
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import marked from 'marked';
import sanitizeHtml from 'sanitize-html';
import './index.css';

let filePath: string = null;
let originalContent = '';

/**
 * it seems not working ?
 */
window.addEventListener(
  'error',
  (window as any).electron.sendUncaughtException
);
const markdownView = document.querySelector('#markdown') as HTMLTextAreaElement;
const htmlView = document.querySelector('#html') as HTMLDivElement;
const newFileButton = document.querySelector('#new-file') as HTMLButtonElement;
const openFileButton = document.querySelector(
  '#open-file'
) as HTMLButtonElement;
const saveMarkdownButton = document.querySelector(
  '#save-markdown'
) as HTMLButtonElement;
const revertButton = document.querySelector('#revert') as HTMLButtonElement;
const saveHtmlButton = document.querySelector(
  '#save-html'
) as HTMLButtonElement;
const showFileButton = document.querySelector(
  '#show-file'
) as HTMLButtonElement;
const openInDefaultButton = document.querySelector(
  '#open-in-default'
) as HTMLButtonElement;

function renderMarkdown2HTML(markdown: string) {
  htmlView.innerHTML = sanitizeHtml(marked(markdown));
}

markdownView.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  (window as any).electron.openContextMenu(filePath);
});
markdownView.addEventListener('keyup', (event) => {
  const currentContent = (event.target as HTMLTextAreaElement).value;
  renderMarkdown2HTML(currentContent);
  updateWindowTitle(currentContent !== originalContent);
});
markdownView.addEventListener('blur', (event) => {
  const currentContent = (event.target as HTMLTextAreaElement).value;
  updateWindowTitle(currentContent !== originalContent);
});

newFileButton.addEventListener('click', () => {
  (window as any).electron.createNewWindow();
});

openFileButton.addEventListener('click', () => {
  (window as any).electron.openFileDialog();
});
revertButton.addEventListener('click', () => {
  markdownView.value = originalContent;
  renderMarkdown2HTML(originalContent);
});
saveMarkdownButton.addEventListener('click', () => {
  (window as any).electron.saveFile(filePath, markdownView.value);
});
saveHtmlButton.addEventListener('click', () => {
  if (!htmlView.innerHTML) {
    return;
  }
  (window as any).electron.saveHTML(htmlView.innerHTML);
});
showFileButton.addEventListener('click', showFileInFolder);
openInDefaultButton.addEventListener('click', openInDefaultApplication);
(window as any).electron.onShowFileInFolder(showFileInFolder);
(window as any).electron.onOpenInDefault(openInDefaultApplication);

/**
 * Receiving new open file content
 */
(window as any).electron.onFileContent(
  (event: any, file: string, content: string) => {
    filePath = file;
    originalContent = content;
    markdownView.value = content;
    renderMarkdown2HTML(content);
    updateWindowTitle();

    showFileButton.disabled = false;
    openInDefaultButton.disabled = false;
  }
);
(window as any).electron.onSaveFile((event: any) => {
  (window as any).electron.saveFile(filePath, markdownView.value);
});
(window as any).electron.onSaveHTML((event: any) => {
  if (!htmlView.innerHTML) {
    return;
  }
  (window as any).electron.saveHTML(htmlView.innerHTML);
});
document.addEventListener('dragstart', (event) => {
  event.preventDefault();
});
document.addEventListener('dragover', (event) => {
  event.preventDefault();
});
document.addEventListener('dragleave', (event) => {
  event.preventDefault();
});
document.addEventListener('drop', (event) => {
  event.preventDefault();
});
markdownView.addEventListener('dragover', (event) => {
  const file = getDraggedFile(event) as unknown as File;
  let classname = 'drag-error';
  if (isFileTypeSupported(file)) {
    classname = 'drag-over';
  }

  markdownView.classList.add(classname);
});

markdownView.addEventListener('dragleave', () => {
  markdownView.classList.remove('drag-over', 'drag-error');
});
markdownView.addEventListener('drop', (event) => {
  const file = getDroppedFile(event);
  if (isFileTypeSupported(file)) {
    (window as any).electron.openFile(file.path);
  } else {
    window.alert(`This file type "${file.type}" is not supported`);
  }
  markdownView.classList.remove('drag-over', 'drag-error');
});

function updateWindowTitle(edited = false) {
  (window as any).electron.updateWindowTitle(filePath, edited);
  saveMarkdownButton.disabled = !edited;
  revertButton.disabled = !edited;
}

function getDraggedFile(event: DragEvent) {
  return event.dataTransfer.items[0];
}
function getDroppedFile(event: DragEvent) {
  return event.dataTransfer.files[0];
}
function isFileTypeSupported(file: File) {
  return ['text/plain', 'text/markdown'].includes(file.type);
}

function showFileInFolder() {
  if (!filePath) {
    alert('This file has not been saved to the filesystem.');
    return;
  }
  (window as any).electron.showFileInFolder(filePath);
}

function openInDefaultApplication() {
  if (!filePath) {
    alert('This file has not been saved to the filesystem.');
    return;
  }
  (window as any).electron.openInDefault(filePath);
}
