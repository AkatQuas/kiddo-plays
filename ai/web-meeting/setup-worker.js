/**
 * setup-worker.js - Postinstall script
 * Copies the mediasoup-worker binary to the worker-bin directory
 * to bypass macOS code signing restrictions in node_modules.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'node_modules', 'mediasoup', 'worker', 'out', 'Release', 'mediasoup-worker');
const DST_DIR = path.join(__dirname, 'worker-bin', 'out', 'Release');
const DST = path.join(DST_DIR, 'mediasoup-worker');

// Skip if source doesn't exist (will be built by mediasoup's postinstall)
if (!fs.existsSync(SRC)) {
  console.log('[setup-worker] mediasoup-worker not yet built, skipping copy');
  process.exit(0);
}

// Ensure target directory exists
fs.mkdirSync(DST_DIR, { recursive: true });

// Copy the binary
try {
  fs.copyFileSync(SRC, DST);
  fs.chmodSync(DST, 0o755);
  
  // Try to remove quarantine xattrs
  try {
    const { execSync } = require('child_process');
    execSync(`xattr -cr "${DST}" 2>/dev/null`, { stdio: 'ignore' });
  } catch (e) {
    // Ignore xattr errors
  }
  
  console.log('[setup-worker] mediasoup-worker binary copied to worker-bin/');
} catch (error) {
  console.error('[setup-worker] Failed to copy worker binary:', error.message);
  process.exit(1);
}
