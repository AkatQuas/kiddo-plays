ipcRenderer.on('nav:toggle', (_) => {
  const nav = document.querySelector('nav#nav');
  if (nav.classList.contains('hide')) {
    nav.classList.remove('hide');
  } else {
    nav.classList.add('hide');
  }
});

ipcRenderer.on('settings:value', (_, settings) => {
  document.querySelector('input#cpu-overload').value = settings.cpuOverload;
  document.querySelector('input#alert-frequency').value =
    settings.alertFrequency;
});

document.querySelector('form#settings-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const cpuOverload = document.querySelector('input#cpu-overload').value;
  const alertFrequency = document.querySelector('input#alert-frequency').value;

  ipcRenderer.send('settings:update', {
    cpuOverload,
    alertFrequency,
  });
  showAlert('Settings Saved');
});
function showAlert(msg) {
  const el = document.querySelector('div#alert');
  el.innerText = msg;
  el.classList.remove('hide');

  setTimeout(() => {
    el.classList.add('hide');
  }, 3000);
}
