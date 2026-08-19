import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface ChapterExample {
  label: string;
  sql: string;
  tooltip?: string;
}

export interface ChapterDataset {
  tables: string[];
  description: string;
}

export interface ChapterConfig {
  id: string;
  title: string;
  category: string;
  order: number;
  theory: string;
  learningObjectives: string[];
  dataset: ChapterDataset;
  examples: ChapterExample[];
  initialSQL: string;
  clozeTemplate?: string;
  resetSQL?: string;
  features?: {
    lockGraph?: boolean;
    migration?: boolean;
  };
}

export interface ChapterMeta {
  id: string;
  title: string;
  category: string;
  order: number;
}

export interface CategoryGroup {
  category: string;
  chapters: ChapterMeta[];
}

@Injectable()
export class ChaptersService {
  private readonly dataDir = path.join(process.cwd(), 'data');
  private chaptersCache: ChapterConfig[] | null = null;

  getAllChapters(): CategoryGroup[] {
    const chapters = this.loadChaptersIndex();
    const grouped = new Map<string, ChapterMeta[]>();

    for (const ch of chapters) {
      const list = grouped.get(ch.category) || [];
      list.push({
        id: ch.id,
        title: ch.title,
        category: ch.category,
        order: ch.order,
      });
      grouped.set(ch.category, list);
    }

    return Array.from(grouped.entries()).map(([category, chapterList]) => ({
      category,
      chapters: chapterList.sort((a, b) => a.order - b.order),
    }));
  }

  getChapterById(id: string): ChapterConfig | null {
    const configPath = path.join(this.dataDir, `chapter_${id}`, 'config.json');
    if (!fs.existsSync(configPath)) {
      const index = this.loadChaptersIndex();
      const meta = index.find((c) => c.id === id);
      if (!meta) return null;
      return {
        ...meta,
        theory: '# Chapter not found',
        learningObjectives: [],
        dataset: { tables: [], description: '' },
        examples: [],
        initialSQL: '',
      };
    }
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw) as ChapterConfig;
  }

  getInitSql(chapterId: string): string | null {
    const initPath = path.join(this.dataDir, `chapter_${chapterId}`, 'init.sql');
    if (!fs.existsSync(initPath)) return null;
    return fs.readFileSync(initPath, 'utf-8');
  }

  private loadChaptersIndex(): ChapterConfig[] {
    if (this.chaptersCache) return this.chaptersCache;
    const indexPath = path.join(this.dataDir, 'chapters.json');
    const raw = fs.readFileSync(indexPath, 'utf-8');
    this.chaptersCache = JSON.parse(raw) as ChapterConfig[];
    return this.chaptersCache;
  }
}
