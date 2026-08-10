import { describe, it, expect } from 'vitest';
import { locatePackageJson, type PackageJsonCandidate } from './packageJsonLocator';

function pkg(path: string, scripts: Record<string, string> | undefined): PackageJsonCandidate {
  return { path, content: JSON.stringify(scripts ? { scripts } : {}) };
}

describe('locatePackageJson', () => {
  it('returns null when there are no candidates', () => {
    expect(locatePackageJson([])).toBeNull();
  });

  it('returns the root package.json when it is the only candidate', () => {
    const result = locatePackageJson([pkg('package.json', { dev: 'vite' })]);
    expect(result).toEqual({
      path: 'package.json',
      dir: '',
      content: JSON.stringify({ scripts: { dev: 'vite' } }),
    });
  });

  it('prefers a nested package.json with a recognized script over a root one without', () => {
    const result = locatePackageJson([
      pkg('package.json', { build: 'turbo run build' }),
      pkg('packages/web/package.json', { dev: 'vite' }),
    ]);
    expect(result?.path).toBe('packages/web/package.json');
    expect(result?.dir).toBe('packages/web');
  });

  it('prefers the root package.json when it has a recognized script, even with nested candidates', () => {
    const result = locatePackageJson([
      pkg('package.json', { dev: 'next dev' }),
      pkg('packages/web/package.json', { dev: 'vite' }),
    ]);
    expect(result?.path).toBe('package.json');
  });

  it('picks the shallowest nested candidate with a recognized script when there is no root', () => {
    const result = locatePackageJson([
      pkg('packages/api/package.json', { dev: 'node index.js' }),
      pkg('apps/web/package.json', { dev: 'vite' }),
    ]);
    expect(result?.path).toBe('apps/web/package.json');
  });

  it('breaks same-depth ties alphabetically for determinism', () => {
    const result = locatePackageJson([
      pkg('packages/web/package.json', { dev: 'vite' }),
      pkg('packages/api/package.json', { dev: 'node index.js' }),
    ]);
    expect(result?.path).toBe('packages/api/package.json');
  });

  it('ignores candidates inside node_modules', () => {
    const result = locatePackageJson([
      pkg('node_modules/some-dep/package.json', { dev: 'should-not-win' }),
      pkg('packages/web/package.json', { dev: 'vite' }),
    ]);
    expect(result?.path).toBe('packages/web/package.json');
  });

  it('returns null when every candidate is inside node_modules', () => {
    const result = locatePackageJson([pkg('node_modules/some-dep/package.json', { dev: 'x' })]);
    expect(result).toBeNull();
  });

  it('falls back to the shallowest candidate when none has a recognized script', () => {
    const result = locatePackageJson([
      pkg('packages/api/package.json', { build: 'tsc' }),
      pkg('package.json', { build: 'turbo run build' }),
    ]);
    expect(result?.path).toBe('package.json');
  });

  it('skips malformed JSON candidates in favor of a valid one with a recognized script', () => {
    const result = locatePackageJson([
      { path: 'package.json', content: 'not json' },
      pkg('packages/web/package.json', { dev: 'vite' }),
    ]);
    expect(result?.path).toBe('packages/web/package.json');
  });
});
