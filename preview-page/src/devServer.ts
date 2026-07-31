const PREFERRED_SCRIPTS = ['dev', 'start', 'serve'] as const;

/**
 * Strips `--turbopack` from every script command in package.json.
 * Turbopack requires native WASM bindings unavailable in WebContainer.
 * Returns the original string unchanged if nothing needs stripping or if
 * the content can't be parsed.
 */
// Returns the major version of the `next` package, or null if not present /
// not parseable. Used to gate --no-turbopack injection.
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

  // --no-turbopack is only valid for Next.js 14–15.
  // 16+ removed the flag (Turbopack is mandatory); <14 didn't have Turbopack.
  // Unknown versions are left alone.
  const nextMajor = getNextMajorVersion(pkg);
  const canDisableTurbopack = nextMajor !== null && nextMajor >= 14 && nextMajor <= 15;

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

    // For Next.js 14–15, Turbopack is the default for `next dev` even without
    // the flag. Inject --no-turbopack to force webpack instead.
    if (canDisableTurbopack && /\bnext\s+dev\b/.test(cmd) && !cmd.includes('--no-turbopack')) {
      cmd = cmd.trimEnd() + ' --no-turbopack';
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
