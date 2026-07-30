import { describe, it, expect } from 'vitest';
import { listMountedFiles, type ReaddirFS } from './listMountedFiles';

function dirEnt(name: string, isDir: boolean) {
  return { name, isDirectory: () => isDir };
}

function fakeFs(tree: Record<string, ReturnType<typeof dirEnt>[]>): ReaddirFS {
  return {
    readdir: async (path) => {
      const entries = tree[path];
      if (!entries) throw new Error(`No such directory: ${path}`);
      return entries;
    },
  };
}

describe('listMountedFiles', () => {
  it('returns an empty list for an empty root', async () => {
    const fs = fakeFs({ '.': [] });
    expect(await listMountedFiles(fs)).toEqual([]);
  });

  it('lists root-level files', async () => {
    const fs = fakeFs({
      '.': [dirEnt('package.json', false), dirEnt('README.md', false)],
    });
    expect(await listMountedFiles(fs)).toEqual(['README.md', 'package.json']);
  });

  it('recurses into nested directories', async () => {
    const fs = fakeFs({
      '.': [dirEnt('src', true), dirEnt('package.json', false)],
      src: [dirEnt('index.ts', false), dirEnt('components', true)],
      'src/components': [dirEnt('Button.tsx', false)],
    });

    expect(await listMountedFiles(fs)).toEqual([
      'package.json',
      'src/components/Button.tsx',
      'src/index.ts',
    ]);
  });
});
