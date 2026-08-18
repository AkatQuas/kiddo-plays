#!/usr/bin/env node
/**
 * 扫描 dp-study 的 .ts 文件，生成 sections.json 供前端使用
 * 提取：文件名、标题、代码内容、section 归类
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC_DIR = join(ROOT, 'src');

type Section = {
  id: string;
  name: string;
  order: number;
  files: FileEntry[];
};

type FileEntry = {
  id: string;
  title: string;
  section: string;
  order: number;
  code: string;
  filePath: string;
};

// 文件夹 → 展示名称、序号
const SECTION_MAP: Record<string, [string, number]> = {
  '01-basics': ['基础篇', 1],
  '02-2d-grid': ['二维网格', 2],
  '03-knapsack': ['背包问题', 3],
  '04-sequence': ['序列问题', 4],
  '05-interval': ['区间 DP', 5],
  '06-advanced': ['进阶模式', 6],
};

// 从代码注释提取标题（@title 或第一个 H2）
function extractTitle(code: string, filename: string): string {
  // 查找 @title 注释
  const titleMatch = code.match(/@title\s+(.+)/);
  if (titleMatch) return titleMatch[1].trim();

  // 查找 /** 中的标题行
  // 查找 /** 中的标题行（跳过 === / --- 装饰行）
  const headerLine = code.split('\n').find(l => {
    const t = l.trim();
    if (!t.startsWith('* ')) return false;
    const after = t.slice(2).trim();
    if (/^[=\-]+$/.test(after)) return false;
    return true;
  });
  if (headerLine) {
    const headerMatch = headerLine.trim().match(/^\*\s+\S+\s+(.+)$/);
    if (headerMatch) return headerMatch[1].trim();
  }

  // 文件名去序号和后缀
  return filename.replace(/^\d+-/, '').replace(/-/g, ' ').replace('.ts', '');
}

function extractOrder(filename: string): number {
  const m = filename.match(/^(\d+)/);
  return m ? parseInt(m[1]) : 999;
}

const sections: Section[] = [];

for (const [dir, [display, dirOrder]] of Object.entries(SECTION_MAP)) {
  const dirPath = join(ROOT, dir);
  if (!statSync(dirPath, { throwIfNoEntry: false })) continue;

  const files = readdirSync(dirPath)
    .filter(f => f.endsWith('.ts'))
    .sort();

  const entries: FileEntry[] = files.map(f => {
    const code = readFileSync(join(dirPath, f), 'utf-8');
    return {
      id: `${dir}/${f.replace('.ts', '')}`,
      title: extractTitle(code, f),
      section: dir,
      order: extractOrder(f),
      code,
      filePath: `/${dir}/${f}`,
    };
  });

  sections.push({
    id: dir,
    name: display,
    order: dirOrder,
    files: entries,
  });
}

// 按 section order 排序
sections.sort((a, b) => a.order - b.order);

const outPath = join(SRC_DIR, 'sections.json');
writeFileSync(outPath, JSON.stringify(sections, null, 2), 'utf-8');
console.log(`✅ Generated ${outPath} — ${sections.length} sections, ${sections.reduce((s, sec) => s + sec.files.length, 0)} files`);
