export function log(...args) {
  const time = (performance.now() / 1000).toFixed(3);
  console.log('At time: ' + time + '---> ', ...args);
}
export function error(...args) {
  const time = (performance.now() / 1000).toFixed(3);
  console.error('At time: ' + time + ' error: ---> ', ...args);
}

export function timerWithNS(ns) {
  return () => `[${ns}] ${(performance.now() / 1000).toFixed(3)}: `;
}
