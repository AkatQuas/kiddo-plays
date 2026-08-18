import { useState, useEffect } from 'preact/hooks';
import { Sidebar } from './components/Sidebar';
import { ContentView } from './components/ContentView';
import type { Section, FileEntry } from './types';

export function App() {
  const [sections, setSections] = useState<Section[]>([]);
  const [currentFile, setCurrentFile] = useState<FileEntry | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch('/src/sections.json')
      .then(r => r.json())
      .then((data: Section[]) => {
        setSections(data);
        setExpandedSections(new Set(data.map(s => s.id)));
        if (data[0]?.files?.[0]) {
          setCurrentFile(data[0].files[0]);
        }
      });
  }, []);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div class="app-layout">
      <header class="app-header">
        <h1 class="app-title">🎯 动态规划从零到中级</h1>
      </header>
      <div class="app-body">
        <Sidebar
          sections={sections}
          currentFile={currentFile}
          expandedSections={expandedSections}
          onSelectFile={setCurrentFile}
          onToggleSection={toggleSection}
        />
        <ContentView file={currentFile} key={currentFile?.id} />
      </div>
    </div>
  );
}
