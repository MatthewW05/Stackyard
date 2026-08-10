import { describe, it, expect } from 'vitest';
import { detectStartScript, sanitizePackageJson } from './devServer';

describe('detectStartScript', () => {
  it('returns null for invalid JSON', () => {
    expect(detectStartScript('not json')).toBeNull();
    expect(detectStartScript('')).toBeNull();
  });

  it('returns null when scripts key is missing', () => {
    expect(detectStartScript(JSON.stringify({ name: 'my-app', version: '1.0.0' }))).toBeNull();
  });

  it('returns null when scripts has no recognized script', () => {
    expect(
      detectStartScript(JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' } })),
    ).toBeNull();
  });

  it('returns "dev" when dev script is present', () => {
    expect(detectStartScript(JSON.stringify({ scripts: { dev: 'vite' } }))).toBe('dev');
  });

  it('returns "start" when only start script is present', () => {
    expect(detectStartScript(JSON.stringify({ scripts: { start: 'node index.js' } }))).toBe(
      'start',
    );
  });

  it('returns "serve" when only serve script is present', () => {
    expect(detectStartScript(JSON.stringify({ scripts: { serve: 'vite preview' } }))).toBe('serve');
  });

  it('prefers "dev" over "start"', () => {
    expect(
      detectStartScript(JSON.stringify({ scripts: { dev: 'vite', start: 'node index.js' } })),
    ).toBe('dev');
  });

  it('prefers "start" over "serve"', () => {
    expect(
      detectStartScript(
        JSON.stringify({ scripts: { start: 'node index.js', serve: 'vite preview' } }),
      ),
    ).toBe('start');
  });

  it('returns null when scripts value is not an object', () => {
    expect(detectStartScript(JSON.stringify({ scripts: 'invalid' }))).toBeNull();
    expect(detectStartScript(JSON.stringify({ scripts: null }))).toBeNull();
  });
});

describe('sanitizePackageJson', () => {
  it('returns the original string when nothing needs stripping', () => {
    const input = JSON.stringify({ scripts: { dev: 'vite' } });
    expect(sanitizePackageJson(input)).toBe(input);
  });

  it('strips --turbopack from next dev on Next.js 15 (webpack is already the default)', () => {
    const input = JSON.stringify({
      dependencies: { next: '^15.0.0' },
      scripts: { dev: 'next dev --turbopack' },
    });
    const result = JSON.parse(sanitizePackageJson(input));
    expect(result.scripts.dev).toBe('next dev');
  });

  it('leaves plain next dev unchanged on Next.js 14-15 (webpack is already the default)', () => {
    const input = JSON.stringify({
      dependencies: { next: '^15.0.0' },
      scripts: { dev: 'next dev' },
    });
    expect(sanitizePackageJson(input)).toBe(input);
  });

  it('adds --webpack to plain next dev for Next.js 16+ (Turbopack is now the default)', () => {
    const input = JSON.stringify({
      dependencies: { next: '^16.0.0' },
      scripts: { dev: 'next dev' },
    });
    const result = JSON.parse(sanitizePackageJson(input));
    expect(result.scripts.dev).toBe('next dev --webpack');
  });

  it('does not add --webpack when next version is unknown', () => {
    const input = JSON.stringify({ scripts: { dev: 'next dev' } });
    const result = JSON.parse(sanitizePackageJson(input));
    expect(result.scripts.dev).toBe('next dev');
  });

  it('does not duplicate --webpack if already present', () => {
    const input = JSON.stringify({
      dependencies: { next: '^16.0.0' },
      scripts: { dev: 'next dev --webpack' },
    });
    expect(sanitizePackageJson(input)).toBe(input);
  });

  it('strips --turbopack from non-dev next commands but does not add --webpack', () => {
    const input = JSON.stringify({
      dependencies: { next: '^16.0.0' },
      scripts: { start: 'next start --turbopack' },
    });
    const result = JSON.parse(sanitizePackageJson(input));
    expect(result.scripts.start).toBe('next start');
  });

  it('does not modify non-next scripts', () => {
    const input = JSON.stringify({ scripts: { dev: 'vite', build: 'vite build' } });
    expect(sanitizePackageJson(input)).toBe(input);
  });

  it('leaves non-script fields intact', () => {
    const input = JSON.stringify({
      name: 'my-app',
      version: '1.0.0',
      scripts: { dev: 'next dev --turbopack' },
    });
    const result = JSON.parse(sanitizePackageJson(input));
    expect(result.name).toBe('my-app');
    expect(result.version).toBe('1.0.0');
  });

  it('returns original string unchanged for invalid JSON', () => {
    expect(sanitizePackageJson('not json')).toBe('not json');
  });

  it('returns original string unchanged when scripts is missing', () => {
    const input = JSON.stringify({ name: 'my-app' });
    expect(sanitizePackageJson(input)).toBe(input);
  });
});
