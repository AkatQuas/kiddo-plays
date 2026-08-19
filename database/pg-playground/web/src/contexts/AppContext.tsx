import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type {
  CategoryGroup,
  ChapterConfig,
  ChapterStatus,
  QueryMessage,
  QueryResultData,
  ResultTab,
} from '../types';
import { syncChapterStatusFromObjectives } from '../utils/objectives';

const PROGRESS_KEY = 'pgplay_progress';
const OBJECTIVES_KEY = 'pgplay_objectives';
const PREFERENCES_KEY = 'pgplay_preferences';

interface Preferences {
  theme: 'light' | 'dark';
  fontSize: number;
  explainMode: boolean;
  clozeMode: boolean;
}

interface AppState {
  categories: CategoryGroup[];
  currentChapterId: string | null;
  chapter: ChapterConfig | null;
  progress: Record<string, ChapterStatus>;
  editorContent: string;
  clozeValues: Record<string, string>;
  preferences: Preferences;
  loading: boolean;
  executing: boolean;
  result: QueryResultData | null;
  activeTab: ResultTab;
  messageLog: QueryMessage[];
  transactionActive: boolean;
  sidebarCollapsed: boolean;
  completedObjectives: Record<string, boolean>;
}

type Action =
  | { type: 'SET_CATEGORIES'; payload: CategoryGroup[] }
  | { type: 'SET_CHAPTER'; payload: ChapterConfig }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_EXECUTING'; payload: boolean }
  | { type: 'SET_EDITOR_CONTENT'; payload: string }
  | { type: 'SET_CLOZE_VALUE'; payload: { key: string; value: string } }
  | { type: 'SET_RESULT'; payload: QueryResultData | null }
  | { type: 'SET_ACTIVE_TAB'; payload: ResultTab }
  | { type: 'ADD_MESSAGES'; payload: QueryMessage[] }
  | { type: 'SET_TRANSACTION_ACTIVE'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_PREFERENCE'; payload: Partial<Preferences> }
  | { type: 'SET_CHAPTER_STATUS'; payload: { id: string; status: ChapterStatus } }
  | { type: 'TOGGLE_OBJECTIVE'; payload: string }
  | { type: 'LOAD_EDITOR'; payload: { chapterId: string; content: string } };

function loadProgress(): Record<string, ChapterStatus> {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadCompletedObjectives(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OBJECTIVES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadPreferences(): Preferences {
  try {
    const raw = localStorage.getItem(PREFERENCES_KEY);
    return raw
      ? JSON.parse(raw)
      : { theme: 'light', fontSize: 14, explainMode: false, clozeMode: false };
  } catch {
    return { theme: 'light', fontSize: 14, explainMode: false, clozeMode: false };
  }
}

function loadEditorContent(chapterId: string): string | null {
  return localStorage.getItem(`pgplay_editor_${chapterId}`);
}

const initialState: AppState = {
  categories: [],
  currentChapterId: null,
  chapter: null,
  progress: loadProgress(),
  editorContent: '',
  clozeValues: {},
  preferences: loadPreferences(),
  loading: false,
  executing: false,
  result: null,
  activeTab: 'data',
  messageLog: [],
  transactionActive: false,
  sidebarCollapsed: false,
  completedObjectives: loadCompletedObjectives(),
};

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_CHAPTER':
      const saved = loadEditorContent(action.payload.id);
      return {
        ...state,
        chapter: action.payload,
        currentChapterId: action.payload.id,
        editorContent: saved || action.payload.initialSQL || '',
        clozeValues: {},
        result: null,
        messageLog: [],
        transactionActive: false,
      };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_EXECUTING':
      return { ...state, executing: action.payload };
    case 'SET_EDITOR_CONTENT':
      return { ...state, editorContent: action.payload };
    case 'SET_CLOZE_VALUE':
      return {
        ...state,
        clozeValues: { ...state.clozeValues, [action.payload.key]: action.payload.value },
      };
    case 'SET_RESULT':
      return {
        ...state,
        result: action.payload,
        transactionActive: action.payload?.transactionStatus === 'active',
      };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'ADD_MESSAGES':
      return { ...state, messageLog: [...action.payload, ...state.messageLog] };
    case 'SET_TRANSACTION_ACTIVE':
      return { ...state, transactionActive: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'SET_PREFERENCE': {
      const preferences = { ...state.preferences, ...action.payload };
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      return { ...state, preferences };
    }
    case 'SET_CHAPTER_STATUS': {
      const progress = { ...state.progress, [action.payload.id]: action.payload.status };
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      return { ...state, progress };
    }
    case 'TOGGLE_OBJECTIVE': {
      const key = action.payload;
      const completedObjectives = { ...state.completedObjectives };

      if (completedObjectives[key]) {
        delete completedObjectives[key];
      } else {
        completedObjectives[key] = true;
      }
      localStorage.setItem(OBJECTIVES_KEY, JSON.stringify(completedObjectives));

      let progress = state.progress;
      if (state.chapter) {
        const chapterId = state.chapter.id;
        const nextStatus = syncChapterStatusFromObjectives(
          state.chapter,
          completedObjectives,
          state.progress[chapterId],
        );
        progress = { ...state.progress, [chapterId]: nextStatus };
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
      }

      return { ...state, completedObjectives, progress };
    }
    case 'LOAD_EDITOR':
      return { ...state, editorContent: action.payload.content };
    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (state.currentChapterId && state.editorContent) {
      localStorage.setItem(`pgplay_editor_${state.currentChapterId}`, state.editorContent);
    }
  }, [state.editorContent, state.currentChapterId]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function getChapterStatus(
  progress: Record<string, ChapterStatus>,
  chapterId: string,
): ChapterStatus {
  return progress[chapterId] || 'not_started';
}

export function calcProgressPercent(
  categories: CategoryGroup[],
  progress: Record<string, ChapterStatus>,
): number {
  const all = categories.flatMap((c) => c.chapters);
  if (all.length === 0) return 0;
  const completed = all.filter((ch) => progress[ch.id] === 'completed').length;
  const inProgress = all.filter((ch) => progress[ch.id] === 'in_progress').length;
  // 进行中章节按半章计入，避免长期显示 0%
  const score = completed + inProgress * 0.5;
  return Math.round((score / all.length) * 100);
}

export { objectiveKey, getUncheckedObjectiveCount, areAllObjectivesComplete, syncChapterStatusFromObjectives } from '../utils/objectives';
