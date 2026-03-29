import { fileTypeFromFile } from 'file-type';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log(await fileTypeFromFile(resolve(__dirname, './shot.png')));
