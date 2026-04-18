import net from 'node:net';

/**
 * ONLY check if proxy server is reachable (TCP connect)
 * @param {string} proxyUrl - e.g. "http://localhost:7777"
 * @returns {Promise<boolean>} true = proxy is accessible
 */
export const checkProxy = (proxyUrl: string) => {
  return new Promise((resolve, reject) => {
    let proxy: URL;
    try {
      proxy = new URL(proxyUrl);
    } catch {
      return reject(new Error('Invalid proxy URL'));
    }

    const socket = new net.Socket();
    socket.setTimeout(5000); // 3s timeout

    // Connect directly to proxy server (only test this)
    socket.connect(Number(proxy.port) || 80, proxy.hostname, () => {
      socket.destroy();
      resolve(true);
    });

    // Failed to connect to proxy
    socket.on('error', (e) => {
      socket.destroy();
      reject(e);
    });

    // Timeout
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Proxy connection timeout'));
    });
  });
};
