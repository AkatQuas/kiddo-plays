import { fileURLToPath } from 'node:url';
import 'zx/globals';

// Calculate paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.resolve(__dirname, '..');
