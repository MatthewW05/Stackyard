import { detectStartScript } from './devServer';

export interface PackageJsonCandidate {
  /** Path relative to the repo root, e.g. "packages/web/package.json". */
  path: string;
  content: string;
}

export interface LocatedPackageJson {
  path: string;
  /** Containing directory relative to the repo root, "" for the repo root itself. */
  dir: string;
  content: string;
}

function depth(path: string): number {
  return path.split('/').length - 1;
}

function isInNodeModules(path: string): boolean {
  return path.split('/').includes('node_modules');
}

/**
 * Picks the `package.json` to treat as the project root out of every
 * candidate found in a mounted repo (StackBlitz's `configPath`-equivalent
 * logic for monorepos). Candidates inside `node_modules` are ignored.
 *
 * Preference order: shallowest path with a recognized dev/start/serve
 * script wins - this naturally prefers the repo root when it has one, since
 * root sorts first. Falls back to the shallowest candidate overall if none
 * has a recognized script, so callers still get a meaningful "no script"
 * error instead of a false "no package.json" one.
 */
export function locatePackageJson(candidates: PackageJsonCandidate[]): LocatedPackageJson | null {
  const filtered = candidates.filter((c) => !isInNodeModules(c.path));
  if (filtered.length === 0) return null;

  const sorted = [...filtered].sort(
    (a, b) => depth(a.path) - depth(b.path) || a.path.localeCompare(b.path),
  );
  const best = sorted.find((c) => detectStartScript(c.content) !== null) ?? sorted[0];

  const lastSlash = best.path.lastIndexOf('/');
  const dir = lastSlash === -1 ? '' : best.path.slice(0, lastSlash);
  return { path: best.path, dir, content: best.content };
}
