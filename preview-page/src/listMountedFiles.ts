/** Minimal slice of WebContainer's FileSystemAPI this module depends on. */
export interface ReaddirFS {
  readdir(
    path: string,
    options: { withFileTypes: true },
  ): Promise<{ name: string; isDirectory(): boolean }[]>;
}

/** Recursively lists every file path mounted under `dir`, for inspection/verification. */
export async function listMountedFiles(fs: ReaddirFS, dir = '.'): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const paths: string[] = [];

  for (const entry of entries) {
    const entryPath = dir === '.' ? entry.name : `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      paths.push(...(await listMountedFiles(fs, entryPath)));
    } else {
      paths.push(entryPath);
    }
  }

  return paths.sort();
}
