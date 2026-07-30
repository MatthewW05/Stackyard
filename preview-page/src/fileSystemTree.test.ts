import { describe, it, expect } from 'vitest';
import { buildFileSystemTree, type RepoFile } from './fileSystemTree';

function textFile(path: string, text: string): RepoFile {
  return { path, contents: new TextEncoder().encode(text) };
}

describe('buildFileSystemTree', () => {
  it('returns an empty tree for no files', () => {
    expect(buildFileSystemTree([])).toEqual({});
  });

  it('mounts a single root-level file', () => {
    const tree = buildFileSystemTree([textFile('package.json', '{}')]);
    expect(Object.keys(tree)).toEqual(['package.json']);
    expect(tree['package.json']).toEqual({
      file: { contents: new TextEncoder().encode('{}') },
    });
  });

  it('creates intermediate directories for nested paths', () => {
    const tree = buildFileSystemTree([textFile('src/components/Button.tsx', 'x')]);

    expect('directory' in tree.src!).toBe(true);
    const src = (tree.src as { directory: typeof tree }).directory;
    expect('directory' in src.components!).toBe(true);
    const components = (src.components as { directory: typeof tree }).directory;
    expect(components['Button.tsx']).toEqual({
      file: { contents: new TextEncoder().encode('x') },
    });
  });

  it('merges multiple files that share a parent directory', () => {
    const tree = buildFileSystemTree([
      textFile('src/index.ts', 'a'),
      textFile('src/utils.ts', 'b'),
    ]);

    const src = (tree.src as { directory: typeof tree }).directory;
    expect(Object.keys(src).sort()).toEqual(['index.ts', 'utils.ts']);
  });

  it('handles files at multiple depths under the same root', () => {
    const tree = buildFileSystemTree([
      textFile('README.md', 'readme'),
      textFile('src/main.ts', 'main'),
      textFile('src/lib/deep/util.ts', 'deep'),
    ]);

    expect(Object.keys(tree).sort()).toEqual(['README.md', 'src']);
    const src = (tree.src as { directory: typeof tree }).directory;
    expect(Object.keys(src).sort()).toEqual(['lib', 'main.ts']);
    const lib = (src.lib as { directory: typeof tree }).directory;
    const deep = (lib.deep as { directory: typeof tree }).directory;
    expect(deep['util.ts']).toEqual({
      file: { contents: new TextEncoder().encode('deep') },
    });
  });
});
