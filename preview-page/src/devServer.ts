const PREFERRED_SCRIPTS = ['dev', 'start', 'serve'] as const;

/**
 * Strips `--turbopack` from every script command in package.json.
 * Turbopack requires native WASM bindings unavailable in WebContainer.
 * Returns the original string unchanged if nothing needs stripping or if
 * the content can't be parsed.
 */
// Returns the major version of the `next` package, or null if not present /
// not parseable. Used to gate --webpack injection.
function getNextMajorVersion(pkg: Record<string, unknown>): number | null {
  const deps = {
    ...((pkg.dependencies as Record<string, string> | undefined) ?? {}),
    ...((pkg.devDependencies as Record<string, string> | undefined) ?? {}),
  };
  const ver = deps['next'];
  if (typeof ver !== 'string') return null;
  const match = /(\d+)/.exec(ver.replace(/^[\^~>=<\s]+/, ''));
  return match ? parseInt(match[1], 10) : null;
}

export function sanitizePackageJson(content: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  if (typeof parsed !== 'object' || parsed === null) return content;

  const pkg = parsed as Record<string, unknown>;
  const scripts = pkg.scripts;
  if (typeof scripts !== 'object' || scripts === null) return content;

  // Turbopack became the default bundler for `next dev` in v16 - before that
  // it was opt-in via --turbopack/--turbo, so plain `next dev` already ran on
  // webpack and needs no help. There has never been a --no-turbopack flag;
  // --webpack is the real (and, as of v16, still supported) opt-out.
  // https://nextjs.org/docs/app/api-reference/turbopack#version-changes
  const nextMajor = getNextMajorVersion(pkg);
  const turbopackIsDefault = nextMajor !== null && nextMajor >= 16;

  let modified = false;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      sanitized[key] = value;
      continue;
    }

    let cmd = value;

    // Strip --turbopack: requires native bindings unavailable in WebContainer.
    if (cmd.includes('--turbopack')) {
      cmd = cmd.replace(/\s*--turbopack\b/g, '');
      modified = true;
    }

    // Next.js 16+ uses Turbopack for `next dev` even without a flag - force
    // webpack back on since Turbopack's native bindings can't run here.
    if (turbopackIsDefault && /\bnext\s+dev\b/.test(cmd) && !cmd.includes('--webpack')) {
      cmd = cmd.trimEnd() + ' --webpack';
      modified = true;
    }

    sanitized[key] = cmd;
  }

  if (!modified) return content;
  return JSON.stringify({ ...pkg, scripts: sanitized }, null, 2);
}

/**
 * Parses a package.json content string and returns the name of the first
 * recognized dev/start script, or null if none is found.
 * Preference order: dev > start > serve.
 */
export function detectStartScript(packageJsonContent: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJsonContent);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const scripts = (parsed as Record<string, unknown>).scripts;
  if (typeof scripts !== 'object' || scripts === null) return null;

  const scriptMap = scripts as Record<string, unknown>;
  for (const name of PREFERRED_SCRIPTS) {
    if (typeof scriptMap[name] === 'string') return name;
  }
  return null;
}
