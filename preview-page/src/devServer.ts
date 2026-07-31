const PREFERRED_SCRIPTS = ['dev', 'start', 'serve'] as const;

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
