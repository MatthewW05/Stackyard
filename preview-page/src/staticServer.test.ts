import { describe, it, expect } from 'vitest';
import { hasStaticEntry, STATIC_SERVER_SCRIPT } from './staticServer';

describe('hasStaticEntry', () => {
  it('returns true when the check resolves', async () => {
    expect(await hasStaticEntry(async () => '<html></html>')).toBe(true);
  });

  it('returns false when the check throws ENOENT', async () => {
    expect(
      await hasStaticEntry(async () => {
        throw new Error('ENOENT');
      }),
    ).toBe(false);
  });

  it('returns false for any error, not just ENOENT', async () => {
    expect(
      await hasStaticEntry(async () => {
        throw new Error('Permission denied');
      }),
    ).toBe(false);
  });
});

describe('STATIC_SERVER_SCRIPT', () => {
  it('is a non-empty string', () => {
    expect(typeof STATIC_SERVER_SCRIPT).toBe('string');
    expect(STATIC_SERVER_SCRIPT.length).toBeGreaterThan(0);
  });

  it('listens on port 3000', () => {
    expect(STATIC_SERVER_SCRIPT).toContain('3000');
  });

  it('serves index.html for root path requests', () => {
    expect(STATIC_SERVER_SCRIPT).toContain('index.html');
  });

  it('uses relative paths so files resolve against the process CWD, not the OS root', () => {
    expect(STATIC_SERVER_SCRIPT).toContain("'.' + urlPath");
  });

  it('maps trailing-slash and root paths to index.html', () => {
    expect(STATIC_SERVER_SCRIPT).toContain("urlPath.endsWith('/')");
  });

  it('strips query strings from request URLs', () => {
    expect(STATIC_SERVER_SCRIPT).toContain(".split('?')");
  });

  it('responds 404 for missing files', () => {
    expect(STATIC_SERVER_SCRIPT).toContain('404');
  });
});
