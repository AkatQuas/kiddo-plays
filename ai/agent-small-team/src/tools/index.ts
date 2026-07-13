import { tool } from '@openai/agents';
import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Global tool pool — all tools available to any agent.
 *
 * Uses strict:false with simple JSON schemas + additionalProperties:true
 * for maximum compatibility with DeepSeek/proxy Chat Completions APIs.
 * Many non-OpenAI APIs don't support the strict schema format
 * (additionalProperties:false, required enum, anyOf for nullable).
 */

const strProp = (desc: string) => ({ type: 'string' as const, description: desc });
const numProp = (desc: string) => ({ type: 'number' as const, description: desc });

export const readFileTool = tool({
  name: 'read_file',
  description:
    'Read the contents of a file at the given path. Returns the full text content of the file.',
  parameters: {
    type: 'object' as const,
    properties: {
      filePath: strProp('Absolute or relative path to the file to read. Example: "src/index.ts"'),
    },
    required: ['filePath'] as string[],
    additionalProperties: true as const,
  },
  strict: false,
  execute: async (input: any) => {
    const filePath = input?.filePath || '.';
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (err: any) {
      return `Error reading file "${filePath}": ${err.message}`;
    }
  },
});

export const listDirectoryTool = tool({
  name: 'list_directory',
  description:
    'List files and directories in a given directory path. Returns lines like "[DIR] src" or "[FILE] package.json". ' +
    'When unsure which directory to list, use "src" or "." as the dirPath.',
  parameters: {
    type: 'object' as const,
    properties: {
      dirPath: strProp('Directory path to list. Use "." for current directory, "src" for source directory, etc.'),
    },
    required: ['dirPath'] as string[],
    additionalProperties: true as const,
  },
  strict: false,
  execute: async (input: any) => {
    const dirPath = input?.dirPath?.trim() || '.';
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .map((e) => `${e.isDirectory() ? '[DIR]' : '[FILE]'} ${e.name}`)
        .join('\n');
    } catch (err: any) {
      return `Error listing directory "${dirPath}": ${err.message}`;
    }
  },
});

export const writeFileTool = tool({
  name: 'write_file',
  description:
    'Write content to a file. Creates parent directories if needed. Returns a success message with byte count.',
  parameters: {
    type: 'object' as const,
    properties: {
      filePath: strProp('Path to write to. Directories are auto-created.'),
      content: strProp('Content to write to the file.'),
    },
    required: ['filePath', 'content'] as string[],
    additionalProperties: true as const,
  },
  strict: false,
  execute: async (input: any) => {
    const filePath = input?.filePath;
    const content = input?.content;
    if (!filePath) return 'Error: filePath is required';
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content || '', 'utf-8');
      return `Successfully wrote ${(content || '').length} bytes to ${filePath}`;
    } catch (err: any) {
      return `Error writing file "${filePath}": ${err.message}`;
    }
  },
});

export const runCommandTool = tool({
  name: 'run_command',
  description:
    'Execute a shell command and return stdout + stderr. Use with caution.',
  parameters: {
    type: 'object' as const,
    properties: {
      command: strProp('Shell command to execute. Example: "ls -la"'),
      timeout: numProp('Timeout in milliseconds. Default 10000.'),
    },
    required: ['command'] as string[],
    additionalProperties: true as const,
  },
  strict: false,
  execute: async (input: any) => {
    const command = input?.command || '';
    const timeout = typeof input?.timeout === 'number' ? input.timeout : 10000;
    if (!command) return 'Error: command is required';
    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        timeout,
        maxBuffer: 1024 * 1024,
      });
      return output || '(no output)';
    } catch (err: any) {
      return `Command error: ${err.message}${err.stdout ? '\n' + err.stdout : ''}${err.stderr ? '\n' + err.stderr : ''}`;
    }
  },
});

export const searchWebTool = tool({
  name: 'search_web',
  description:
    'Simulated web search. Returns mock results for the given query. Use when the task requires online research or fact-finding.',
  parameters: {
    type: 'object' as const,
    properties: {
      query: strProp('The search query string'),
    },
    required: ['query'] as string[],
    additionalProperties: true as const,
  },
  strict: false,
  execute: async (input: any) => {
    const query = input?.query || '';
    return `[Simulated web search results for: "${query}"]
This is a simulated result. In production, this would call a real search API.
Top result: Information about "${query}" can be found by consulting relevant documentation.`;
  },
});

/**
 * All tools in the global pool, keyed by name.
 */
export const toolRegistry: Record<string, any> = {
  read_file: readFileTool,
  list_directory: listDirectoryTool,
  write_file: writeFileTool,
  run_command: runCommandTool,
  search_web: searchWebTool,
};

/**
 * Resolve tool names to actual tool objects.
 */
export function resolveTools(names: string[]): any[] {
  return names
    .map((name) => toolRegistry[name])
    .filter(Boolean);
}