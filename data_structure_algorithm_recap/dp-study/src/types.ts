export type FileEntry = {
  id: string;
  title: string;
  section: string;
  order: number;
  code: string;
  filePath: string;
};

export type Section = {
  id: string;
  name: string;
  order: number;
  files: FileEntry[];
};
