// This file is required by the index.html file and will
// be executed in the renderer process for that window.

const { clipboard, desktopCapturer, ipcRenderer } = require('electron');
const { screen, shell, BrowserWindow } = require('electron').remote;

// No Node.js APIs would be available in this process if
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.
const path = require('path');
const fs = require('fs');
const os = require('os');

(function linksOpenOutside() {
  const links = document.querySelectorAll('a[href]');
  Array.prototype.forEach.call(links, (link) => {
    const url = link.getAttribute('href');
    if (url.indexOf('http') === 0) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        shell.openExternal(url);
      });
    }
  });
})();

(function IPC_message() {
  /**
   * synchronous-messages handler
   */
  const syncMsgBtn = document.getElementById('sync-msg');
  syncMsgBtn.addEventListener('click', () => {
    const reply = ipcRenderer.sendSync('synchronous-message', 'ping', 'ping2', {
      repeat: 3,
    });
    const message = `Synchronous message reply: ${reply}`;
    document.getElementById('sync-reply').innerHTML = message;
  });

  /**
   * asynchronous-messages handler
   */
  const asyncMsgBtn = document.getElementById('async-msg');

  asyncMsgBtn.addEventListener('click', () => {
    ipcRenderer.send('asynchronous-message', 'ping', { flow: true });
  });

  ipcRenderer.on('asynchronous-reply', (event, arg) => {
    const message = `Asynchronous message reply: ${arg}`;
    document.getElementById('async-reply').innerHTML = message;
  });
})();

(function takeScreenshot() {
  const screenshot = document.getElementById('screen-shot');
  const screenshotMsg = document.getElementById('screenshot-path');

  screenshot.addEventListener('click', (event) => {
    screenshotMsg.textContent = 'Gathering screens...';
    const thumbSize = determineScreenShotSize();
    const options = { types: ['screen'], thumbnailSize: thumbSize };

    desktopCapturer.getSources(options, (error, sources) => {
      if (error) return console.log(error);

      sources.forEach((source) => {
        const sourceName = source.name.toLowerCase();
        if (sourceName === 'entire screen' || sourceName === 'screen 1') {
          const screenshotPath = path.join(os.tmpdir(), 'screenshot.png');

          fs.writeFile(screenshotPath, source.thumbnail.toPNG(), (error) => {
            if (error) {
              return console.log(error);
            }
            shell.openExternal(`file://${screenshotPath}`);

            const message = `Saved screenshot to: ${screenshotPath}`;
            screenshotMsg.textContent = message;
          });
        }
      });
    });
  });

  function determineScreenShotSize() {
    const screenSize = screen.getPrimaryDisplay().workAreaSize;
    const maxDimension = Math.max(screenSize.width, screenSize.height);
    return {
      width: maxDimension * window.devicePixelRatio,
      height: maxDimension * window.devicePixelRatio,
    };
  }
})();

(function createMenu() {
  // Tell main process to show the menu when demo button is clicked
  const contextMenuBtn = document.getElementById('context-menu');

  contextMenuBtn.addEventListener('click', () => {
    ipcRenderer.send('show-context-menu');
  });
})();

(function windowEvent() {
  const listenToWindowBtn = document.getElementById('listen-to-window');
  const focusModalBtn = document.getElementById('focus-on-modal-window');

  let win;

  listenToWindowBtn.addEventListener('click', () => {
    const modalPath = 'https://electronjs.org';
    win = new BrowserWindow({ width: 600, height: 400 });

    const hideFocusBtn = () => {
      focusModalBtn.classList.add('disappear');
      focusModalBtn.classList.remove('smooth-appear');
      focusModalBtn.removeEventListener('click', clickHandler);
    };

    const showFocusBtn = (btn) => {
      if (!win) return;
      focusModalBtn.classList.add('smooth-appear');
      focusModalBtn.classList.remove('disappear');
      focusModalBtn.addEventListener('click', clickHandler);
    };

    win.on('focus', hideFocusBtn);
    win.on('blur', showFocusBtn);
    win.on('close', () => {
      hideFocusBtn();
      win = null;
    });
    win.loadURL(modalPath);
    win.show();

    const clickHandler = () => {
      win.focus();
    };
  });
})();

(function framelessWindow() {
  const newWindowBtn = document.getElementById('frameless-window');

  newWindowBtn.addEventListener('click', (event) => {
    let win = new BrowserWindow({
      frame: false,
      transparent: true,
      backgroundColor: '#cb66ccff',
    });

    win.on('close', () => {
      win = null;
    });

    win.loadURL(
      'data:text/html,<h2>Hello World!</h2><a id="close" href="javascript:window.close()">Close this Window</a>'
    );
    win.show();
  });
})();

(function manageWindow() {
  const manageWindowBtn = document.getElementById('manage-window');
  manageWindowBtn.addEventListener('click', (event) => {
    const modalPath = 'https://electronjs.org';
    win = new BrowserWindow({
      width: 400,
      height: 275,
      webPreferences: {
        contextIsolation: true,
      },
    });

    win.on('resize', updateReply);
    win.on('move', updateReply);
    win.on('close', () => {
      win = null;
    });
    win.loadURL(modalPath);
    win.show();

    function updateReply() {
      const manageWindowReply = document.getElementById('manage-window-reply');
      const message = `Size: ${win.getSize()} Position: ${win.getPosition()}`;
      manageWindowReply.innerText = message;
    }
  });
})();

(function withClipboard() {
  const copyBtn = document.getElementById('copy-to');
  const copyInput = document.getElementById('copy-to-input');

  copyBtn.addEventListener('click', () => {
    if (copyInput.value !== '') {
      copyInput.value = '';
    }
    copyInput.placeholder = 'Copied! Paste here to see.';
    clipboard.writeText('Electron Demo!');
  });

  const pasteBtn = document.getElementById('paste-to');
  pasteBtn.addEventListener('click', () => {
    clipboard.writeText('What a pasted demo!');
    const message = `Clipboard contents: ${clipboard.readText()}`;
    document.getElementById('paste-from').innerHTML = message;
  });
})();

(function appInformation() {
  const appInfoBtn = document.getElementById('app-info');

  appInfoBtn.addEventListener('click', () => {
    ipcRenderer.send('get-app-path');
  });

  ipcRenderer.on('got-app-path', (event, path) => {
    const message = `This app is located at: ${path}`;
    document.getElementById('got-app-info').innerHTML = message;
  });
})();

/**
 * launch-app-from-URL-in-another-app
 */
(function launchApp() {
  const openInBrowserButton = document.getElementById('open-in-browser');
  const openAppLink = document.getElementById('open-app-link');
  // Hides openAppLink when loaded inside Electron
  openAppLink.style.display = 'none';

  openInBrowserButton.addEventListener('click', () => {
    console.log('clicked');
    const pageDirectory = __dirname.replace('app.asar', 'app.asar.unpacked');
    const pagePath = path.join('file://', pageDirectory, 'index.html');
    shell.openExternal(pagePath);
  });
})();

(function versionInfo() {
  const versionInfoBtn = document.getElementById('version-info');

  const electronVersion = process.versions.electron;

  versionInfoBtn.addEventListener('click', () => {
    const message = `This app is using Electron version: ${electronVersion}`;
    document.getElementById('got-version-info').innerHTML = message;
  });
})();

(function dragAndDrop() {
  const dragFileLink = document.getElementById('drag-file-link');

  dragFileLink.addEventListener('dragstart', (event) => {
    event.preventDefault();
    // or any other file, using absolute path
    ipcRenderer.send('ondragstart', path.resolve(__dirname, 'main.js'));
  });
})();

(function openFileOrDirectory() {
  const selectDirBtn = document.getElementById('select-directory');

  selectDirBtn.addEventListener('click', (event) => {
    ipcRenderer.send('open-file-dialog');
  });

  ipcRenderer.on('selected-directory', (event, path) => {
    document.getElementById(
      'selected-file'
    ).innerHTML = `You selected: ${path}`;
  });
})();

(function saveFile() {
  const saveBtn = document.getElementById('save-dialog');

  saveBtn.addEventListener('click', (event) => {
    ipcRenderer.send('save-dialog');
  });

  ipcRenderer.on('saved-file', (event, path) => {
    if (!path) {
      path = 'No path';
    }
    document.getElementById('file-saved').innerHTML = `Path selected: ${path}`;
  });
})();

(function informationDialog() {
  const informationBtn = document.getElementById('information-dialog');

  informationBtn.addEventListener('click', (event) => {
    ipcRenderer.send('open-information-dialog');
  });

  ipcRenderer.on('information-dialog-selection', (event, index) => {
    let message = 'You selected ';
    if (index === 0) message += 'yes.';
    else message += 'no.';
    document.getElementById('info-selection').innerHTML = message;
  });

  const errorBtn = document.getElementById('error-dialog');

  errorBtn.addEventListener('click', (event) => {
    ipcRenderer.send('open-error-dialog');
  });
})();

(function darkModeToggle() {
  document
    .getElementById('toggle-dark-mode')
    .addEventListener('click', async () => {
      const isDarkMode = await ipcRenderer.invoke('dark-mode:toggle');
      document.getElementById('theme-source').innerHTML = isDarkMode
        ? 'Dark'
        : 'Light';
    });

  document
    .getElementById('reset-to-system')
    .addEventListener('click', async () => {
      await ipcRenderer.invoke('dark-mode:system');
      document.getElementById('theme-source').innerHTML = 'System';
    });
})();

(function showNotification() {
  const myNotification = new Notification('Title', {
    body: 'Notification from the Renderer process',
  });

  myNotification.onclick = () => {
    console.log('Notification clicked');
  };
})();

(function onlineChange() {
  const updateOnlineStatus = () => {
    console.warn(navigator.onLine ? 'online' : 'offline');
    // send message to ipcMain
    ipcRenderer.send(
      'online-status-changed',
      navigator.onLine ? 'online' : 'offline'
    );
  };

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  updateOnlineStatus();
})();
