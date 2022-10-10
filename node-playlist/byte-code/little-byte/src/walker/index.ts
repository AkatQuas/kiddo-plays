import * as fs from 'fs';
import * as path from 'path';
import { compileFile } from '../compiler/index';

type WalkAction = 'ignore' | 'compile' | 'copy';

type FileInfo = {
  /** Full path for the file */
  path: string;
  /** Relative path to source directory, convenient for destination calculation */
  relativePath: string;
  /** File name */
  name: string;
  /** File extension */
  ext: string;
  /** Set to `true` when `ext` equals to `.js` */
  isScript: boolean;
};

interface WalkOptions {
  /** Suppress log information */
  silent?: boolean;
  /** Source directory */
  inputDir: string;
  /** Destination directory */
  outputDir: string;
  /** Action for each file */
  onFile: (fileInfo: FileInfo, defaultAction: WalkAction) => WalkAction;
}

async function ensureDir(dirPath: string) {
  try {
    await fs.promises.stat(dirPath);
  } catch (e) {
    await fs.promises.mkdir(dirPath, {
      recursive: true,
    });
  }
}

async function processFile(
  fileInfo: FileInfo,
  action: WalkAction,
  outputDir: string,
  silent = false
) {
  /** It's convenient to calculate with relativePath in advance */
  const targetDir = path.dirname(path.join(outputDir, fileInfo.relativePath));
  switch (action) {
    case 'copy':
      silent || console.log(` - Copy: ${fileInfo.relativePath}`);
      await ensureDir(targetDir);
      await fs.promises.copyFile(
        fileInfo.path,
        path.join(targetDir, fileInfo.name)
      );
      break;
    case 'ignore':
      break;
    case 'compile':
      silent || console.log(` - Compile: ${fileInfo.relativePath}`);
      await ensureDir(targetDir);
      await compileFile(fileInfo.path, targetDir);
      break;
    default:
      throw new Error(
        `little-byte: invalid action ${action} for file ${fileInfo.relativePath}`
      );
  }
}

export async function start({
  inputDir,
  outputDir,
  onFile,
  silent,
}: WalkOptions) {
  const dirs: string[] = [inputDir];

  let currentDir;

  while ((currentDir = dirs.shift())) {
    const files = await fs.promises.readdir(currentDir, {
      withFileTypes: true,
    });
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const currentPath = path.join(currentDir, file.name);
      if (file.isDirectory()) {
        // Push the next directory to do the BFS for tree
        dirs.push(currentPath);
        continue;
      }
      const fileExt = path.extname(file.name).toLowerCase();
      const fileInfo: FileInfo = Object.freeze({
        path: currentPath,
        relativePath: path.relative(inputDir, currentPath),
        name: file.name,
        ext: fileExt,
        isScript: fileExt === '.js',
      });

      try {
        const action = onFile(
          fileInfo,
          fileInfo.isScript ? 'compile' : 'ignore'
        );

        if (!fileInfo.isScript && action === 'compile') {
          throw new Error(
            `little-byte: cannot compile non-js file: ${fileInfo.relativePath}`
          );
        }

        // Create a Job to boost, maybe https://www.npmjs.com/package/qjobs
        await processFile(fileInfo, action || 'ignore', outputDir, silent);
      } catch (e) {
        console.log(fileInfo, e);
      }
    }
  }
}
