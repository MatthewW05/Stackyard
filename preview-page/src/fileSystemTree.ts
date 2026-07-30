import type { FileSystemTree } from '@webcontainer/api';

export interface RepoFile {
  /** Path relative to the repo root, e.g. "src/components/Button.tsx". */
  path: string;
  contents: Uint8Array;
}

/**
 * Converts a flat list of repo files into the nested structure
 * WebContainer's `mount()` expects, creating intermediate directory nodes
 * as needed.
 */
export function buildFileSystemTree(files: RepoFile[]): FileSystemTree {
  const root: FileSystemTree = {};

  for (const { path, contents } of files) {
    const segments = path.split('/');
    const fileName = segments.pop()!;

    let dir = root;
    for (const segment of segments) {
      const existing = dir[segment];
      if (existing && 'directory' in existing) {
        dir = existing.directory;
      } else {
        const directory: FileSystemTree = {};
        dir[segment] = { directory };
        dir = directory;
      }
    }

    dir[fileName] = { file: { contents } };
  }

  return root;
}
