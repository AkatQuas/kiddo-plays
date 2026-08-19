import { message } from 'antd';
import type { ChapterConfig, ChapterStatus } from '../types';

export function objectiveKey(chapterId: string, index: number): string {
  return `${chapterId}_obj_${index}`;
}

export function isObjectiveComplete(
  chapterId: string,
  index: number,
  completedObjectives: Record<string, boolean>,
): boolean {
  return completedObjectives[objectiveKey(chapterId, index)] === true;
}

export function getUncheckedObjectiveCount(
  chapter: ChapterConfig,
  completedObjectives: Record<string, boolean>,
): number {
  return chapter.learningObjectives.filter(
    (_, idx) => !isObjectiveComplete(chapter.id, idx, completedObjectives),
  ).length;
}

export function areAllObjectivesComplete(
  chapter: ChapterConfig,
  completedObjectives: Record<string, boolean>,
): boolean {
  if (chapter.learningObjectives.length === 0) return false;
  return chapter.learningObjectives.every((_, idx) =>
    isObjectiveComplete(chapter.id, idx, completedObjectives),
  );
}

/** 根据学习目标勾选情况同步章节进度 */
export function syncChapterStatusFromObjectives(
  chapter: ChapterConfig,
  completedObjectives: Record<string, boolean>,
  currentStatus: ChapterStatus | undefined,
): ChapterStatus {
  if (areAllObjectivesComplete(chapter, completedObjectives)) return 'completed';
  if (!currentStatus || currentStatus === 'not_started') return 'not_started';
  return 'in_progress';
}

export function remindUncheckedObjectives(
  chapter: ChapterConfig,
  completedObjectives: Record<string, boolean>,
): void {
  const remaining = getUncheckedObjectiveCount(chapter, completedObjectives);
  if (remaining > 0) {
    message.info({
      content: `实验执行成功！请在左侧勾选已完成的学习目标（还剩 ${remaining} 项），以记录本章进度。`,
      duration: 5,
    });
  }
}
