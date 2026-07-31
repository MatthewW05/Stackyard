const PREFERRED_SCRIPTS = ['dev', 'start', 'serve'] as const;

/**
 * Strips `--turbopack` from every script command in package.json.
 * Turbopack requires native WASM bindings unavailable in WebContainer.
 * Returns the original string unchanged if nothing needs stripping or if
 * the content can't be parsed.
 */
export function sanitizePackageJson(content: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return content;
  }
  if (typeof parsed !== 'object' || parsed === null) return content;

  const scripts = (parsed as Record<string, unknown>).scripts;
  if (typeof scripts !== 'object' || scripts === null) return content;

  let modified = false;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(scripts as Record<string, unknown>)) {
    if (typeof value === 'string' && value.includes('--turbopack')) {
      sanitized[key] = value.replace(/\s*--turbopack\b/g, '');
      modified = true;
    } else {
      sanitized[key] = value;
    }
  }

  if (!modified) return content;
  return JSON.stringify({ ...(parsed as object), scripts: sanitized }, null, 2);
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
