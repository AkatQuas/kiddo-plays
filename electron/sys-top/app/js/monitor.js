const { ipcRenderer } = require('electron');
const path = require('path');
const osu = require('node-os-utils');

const cpu = osu.cpu;
const mem = osu.mem;
const os = osu.os;

let cpuOverload = 5;
let alertFrequency = 1;

ipcRenderer.on('settings:value', (_, settings) => {
  cpuOverload = +settings.cpuOverload;
  alertFrequency = +settings.alertFrequency;
});

/* static data */

// cpu model
document.querySelector('div#cpu-model').innerText = cpu.model();

// computer name
document.querySelector('span#comp-name').innerText = os.hostname();

//  os
document.querySelector('span#os').innerText = `${os.type()} ${os.arch()}`;

// Total Memory
mem.info().then((info) => {
  document.querySelector('span#mem-total').innerText = info.totalMemMb;
});

/* dynamic data */

setInterval(() => {
  cpu.usage().then((info) => {
    document.querySelector('span#cpu-usage').innerText = info.toFixed(2) + '%';
    const progress = document.querySelector('div#cpu-progress');
    progress.style.width = info.toFixed(2) + '%';

    if (info > cpuOverload) {
      progress.classList.add('error');

      if (shouldNotify()) {
        notifyUser({
          title: 'CPU Overload',
          body: 'CPU is over',
          icon: path.resolve(__dirname, 'img', 'icon.png'),
        });
      }
    } else {
      progress.classList.remove('error');
    }

    document.querySelector('span#cpu-free').innerText =
      (100 - info).toFixed(2) + '%';
  });
  // robust data
  // cpu.free().then((info) => {
  //   document.querySelector('span#cpu-free').innerText = info.toFixed(2) + '%';
  // });

  document.querySelector('span#sys-uptime').innerText = seconds2DHMS(
    os.uptime()
  );
}, 4000);

/* --- helper --- */
function seconds2DHMS(seconds) {
  seconds = +seconds;
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d}d, ${h}h, ${m}m, ${s}s`;
}

function notifyUser(options) {
  new Notification(options.title, options);
}

function shouldNotify() {
  const last = localStorage.getItem('lastNotify');

  if (!last) {
    localStorage.setItem('lastNotify', Date.now());
    return true;
  }

  const n = Date.now();
  if (n > parseInt(last) + alertFrequency * 60 * 1000) {
    localStorage.setItem('lastNotify', n);
    return true;
  }

  return false;
}
