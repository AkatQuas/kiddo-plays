import type { Section, FileEntry } from '../types';

type Props = {
  sections: Section[];
  currentFile: FileEntry | null;
  expandedSections: Set<string>;
  onSelectFile: (f: FileEntry) => void;
  onToggleSection: (id: string) => void;
};

export function Sidebar({ sections, currentFile, expandedSections, onSelectFile, onToggleSection }: Props) {
  

  // 给每个 section 加 emoji
  const sectionEmoji: Record<string, string> = {
    '01-basics': '📘',
    '02-2d-grid': '📐',
    '03-knapsack': '🎒',
    '04-sequence': '🧬',
    '05-interval': '🔗',
    '06-advanced': '🚀',
  };

  // 给每个文件加 emoji (按序号)
  const fileEmoji = (file: FileEntry): string => {
    const icons = ['🧪', '📖', '📖', '💡', '💡', '💡', '⚡', '⚡', '🏗️', '🏗️'];
    return icons[(file.order - 1) % icons.length] || '📄';
  };

  return (
    <nav class="sidebar">
      <div class="sidebar-inner">
        {sections.map(section => (
          <div class="sidebar-section" key={section.id}>
            <button
              class="sidebar-section-header"
              onClick={() => onToggleSection(section.id)}
            >
              <span class="sidebar-arrow">{expandedSections.has(section.id) ? '▼' : '▶'}</span>
              <span class="sidebar-section-emoji">{sectionEmoji[section.id] || '📁'}</span>
              <span class="sidebar-section-name">{section.name}</span>
              <span class="sidebar-section-count">{section.files.length}</span>
            </button>
            {expandedSections.has(section.id) && (
              <div class="sidebar-files">
                {section.files.map(file => (
                  <button
                    key={file.id}
                    class={`sidebar-file ${currentFile?.id === file.id ? 'active' : ''}`}
                    onClick={() => onSelectFile(file)}
                  >
                    <span class="sidebar-file-emoji">{fileEmoji(file)}</span>
                    <span class="sidebar-file-title">{file.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
