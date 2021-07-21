import { crashReporter } from 'electron';
import { config, sendUncaughtException } from './send-func';

crashReporter.start(config);

if (process.type === 'browser') {
  process.on('uncaughtException', sendUncaughtException);
}

console.log('[INFO] Crash Reporter Started.', crashReporter);

export { crashReporter };
