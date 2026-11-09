'use strict';

var logEl = document.getElementById('log');
var seq = 0;

function log(line) {
  logEl.textContent += line + '\n';
  logEl.scrollTop = logEl.scrollHeight;
}

window.onCallback = function (callbackId, errorInfo, data) {
  var body = typeof data === 'string' ? data : JSON.stringify(data);
  log('[onCallback] id=' + callbackId + ' err=' + (errorInfo || '(none)') + ' data=' + body);
};

window.onEvent = function (eventId, data) {
  var body = typeof data === 'string' ? data : JSON.stringify(data);
  log('[onEvent] ' + eventId + ' ' + body);
};

function call(module, method, paramObj) {
  var callbackId = 'cb-' + (++seq);
  var param = JSON.stringify(paramObj || {});
  log('→ QtBridge(' + module + ', ' + method + ', ' + callbackId + ', …)');
  if (typeof window.QtBridge !== 'function') {
    log('QtBridge missing — CEF render inject failed');
    return;
  }
  window.QtBridge(module, method, callbackId, param);
}

document.getElementById('btnVersion').onclick = function () {
  call('system', 'getVersion', {});
};
document.getElementById('btnNode').onclick = function () {
  call('sidecar', 'start', { kind: 'node', port: 58999 });
};
document.getElementById('btnPython').onclick = function () {
  call('sidecar', 'start', { kind: 'python', port: 58999 });
};
document.getElementById('btnSend').onclick = function () {
  call('sidecar', 'send', { hello: 'qtbridge', t: Date.now() });
};
document.getElementById('btnStop').onclick = function () {
  call('sidecar', 'stop', {});
};

log('page ready; QtBridge typeof = ' + typeof window.QtBridge);
