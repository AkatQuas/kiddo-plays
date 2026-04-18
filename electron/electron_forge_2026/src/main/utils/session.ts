import { type ProxyConfig, session } from 'electron';
import { settingsStore } from '../stores/settingsStore';
import { cookieStore } from '../stores/userStore';
import { checkProxy } from './check-proxy';

export async function applySessionProxy(proxy = settingsStore.get('proxy')) {
  if (proxy?.enable && proxy.url && proxy.port) {
    const proxyUrl = `http://${proxy.url}:${proxy.port}`;

    // Check proxy connection before applying
    await checkProxy(proxyUrl);

    const proxyConfig: ProxyConfig = {
      mode: 'fixed_servers',
      proxyRules: `http=${proxyUrl};https=${proxyUrl}`,
      proxyBypassRules: '<local>',
    };

    session.defaultSession.setProxy(proxyConfig);
  } else {
    session.defaultSession.setProxy({ mode: 'system' });
  }
}

/**
 * Inject stored cookies into Electron session for a specific domain
 * @param domain The domain to inject cookies for
 */
export async function injectSessionCookie(domain: string) {
  const cookies = cookieStore.get(domain, []);
  for (const parsed of cookies) {
    const [name, value] = Object.entries(parsed)[0];
    const url = `https://${domain}`;
    await session.defaultSession.cookies.set({
      url,
      name,
      value,
      secure: true,
      httpOnly: false,
    });
  }
}
