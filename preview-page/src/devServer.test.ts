import { describe, it, expect } from 'vitest';
import { detectStartScript } from './devServer';

describe('detectStartScript', () => {
  it('returns null for invalid JSON', () => {
    expect(detectStartScript('not json')).toBeNull();
    expect(detectStartScript('')).toBeNull();
  });

  it('returns null when scripts key is missing', () => {
    expect(detectStartScript(JSON.stringify({ name: 'my-app', version: '1.0.0' }))).toBeNull();
  });

  it('returns null when scripts has no recognized script', () => {
    expect(detectStartScript(JSON.stringify({ scripts: { build: 'vite build', test: 'vitest' } }))).toBeNull();
  });

  it('returns "dev" when dev script is present', () => {
    expect(detectStartScript(JSON.stringify({ scripts: { dev: 'vite' } }))).toBe('dev');
  });

  it('returns "start" when only start script is present', () => {
    expect(detectStartScript(JSON.stringify({ scripts: { start: 'node index.js' } }))).toBe('start');
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
      detectStartScript(JSON.stringify({ scripts: { start: 'node index.js', serve: 'vite preview' } })),
    ).toBe('start');
  });

  it('returns null when scripts value is not an object', () => {
    expect(detectStartScript(JSON.stringify({ scripts: 'invalid' }))).toBeNull();
    expect(detectStartScript(JSON.stringify({ scripts: null }))).toBeNull();
  });
});
