/**
 * Full-chain E2E test using Playwright virtual WebAuthn authenticator.
 * Run: node scripts/e2e.mjs  (requires server+client dev running)
 */
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const USERNAME = `test_${Date.now()}`;

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`✓ ${name}`);
}

function fail(name, err) {
  results.push({ name, ok: false, err: String(err) });
  console.error(`✗ ${name}: ${err}`);
  throw err;
}

async function setupPage(context) {
  const page = await context.newPage();
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return page;
}

async function main() {
  console.log(`E2E against ${BASE}, username: ${USERNAME}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await setupPage(context);

  // 1. Home page loads
  await page.goto(`${BASE}/`);
  if (!(await page.locator('h1').first().isVisible())) {
    fail('Home page loads', 'h1 not visible');
  }
  pass('Home page loads');

  // 2. Register with Passkey
  await page.goto(`${BASE}/register`);
  await page.fill('#username', USERNAME);
  await page.click('button[type=submit]');
  try {
    await page.waitForURL('**/dashboard', { timeout: 30000 });
  } catch {
    const errText = await page.locator('.alert.error').textContent().catch(() => 'unknown');
    fail('Register → Dashboard', errText);
  }
  pass('Register → Dashboard');

  // 3. Session persists (/api/auth/me via dashboard protected data)
  await page.waitForSelector('.code-block', { timeout: 10000 });
  const protectedText = await page.locator('.code-block').textContent();
  if (!protectedText?.includes('protected data')) {
    fail('Protected API on Dashboard', protectedText);
  }
  pass('Protected API on Dashboard');

  // 4. Refresh keeps session
  await page.reload();
  await page.waitForURL('**/dashboard');
  pass('Session persists after refresh');

  // 5. Guest route redirects logged-in user away from /login
  await page.goto(`${BASE}/login`);
  await page.waitForURL('**/dashboard');
  pass('GuestRoute redirects /login → /dashboard');

  // 6. Add second passkey (second virtual authenticator with USB transport)
  const client = await context.newCDPSession(page);
  await client.send('WebAuthn.enable');
  await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'usb',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  await page.goto(`${BASE}/passkeys`);
  await page.fill('input[placeholder="Device name (optional)"]', 'Backup Key');
  await page.click('button:has-text("Add Passkey")');
  try {
    await page.waitForSelector('.alert.success', { timeout: 30000 });
  } catch {
    const errText = await page.locator('.alert.error').textContent().catch(() => 'unknown');
    fail('Add second passkey', errText);
  }
  const passkeyItems = page.locator('.passkey-item');
  if (await passkeyItems.count() !== 2) {
    fail('Add second passkey', `expected 2 passkeys, got ${await passkeyItems.count()}`);
  }
  pass('Add second passkey (2 total)');

  // 7. Delete non-last passkey
  page.once('dialog', (d) => d.accept());
  await passkeyItems.last().locator('button:has-text("Delete")').click();
  await page.waitForSelector('.alert.success');
  if (await passkeyItems.count() !== 1) {
    fail('Delete non-last passkey', `expected 1 passkey, got ${await passkeyItems.count()}`);
  }
  pass('Delete non-last passkey');

  // 8. Session still valid after passkey delete
  await page.goto(`${BASE}/dashboard`);
  await page.waitForSelector('.code-block');
  pass('Session valid after passkey delete');

  // 9. Logout (from protected page → redirects to /login)
  await page.click('button:has-text("Logout")');
  await page.waitForURL('**/login');
  pass('Logout');

  // 10. Protected route redirects to login
  await page.goto(`${BASE}/dashboard`);
  await page.waitForURL('**/login');
  pass('Protected route redirects to /login');

  // 11. Login with Passkey
  await page.fill('#username', USERNAME);
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  pass('Login → Dashboard');

  // 12. Protected API works after login
  await page.waitForSelector('.code-block');
  pass('Protected API after login');

  // 13. Delete last passkey after confirmation
  await page.goto(`${BASE}/passkeys`);
  page.once('dialog', (d) => d.accept());
  await page.locator('.passkey-item').first().locator('button:has-text("Delete")').click();
  await page.waitForSelector('.alert.success');
  if ((await page.locator('.passkey-item').count()) !== 0) {
    fail('Delete last passkey', 'expected 0 passkeys');
  }
  pass('Delete last passkey with confirmation');

  await browser.close();

  console.log(`\n${results.length}/${results.length} checks passed`);
}

main().catch((err) => {
  console.error('\nE2E FAILED:', err.message);
  process.exit(1);
});
