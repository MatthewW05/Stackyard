export interface UnsupportedTech {
  tech: string;
  message: string;
}

interface Check {
  match: (paths: string[]) => boolean;
  tech: string;
  message: string;
}

function hasFileNamed(paths: string[], name: string): boolean {
  return paths.some((p) => p === name || p.endsWith('/' + name));
}

const CHECKS: Check[] = [
  {
    match: (paths) =>
      hasFileNamed(paths, 'requirements.txt') ||
      hasFileNamed(paths, 'pyproject.toml') ||
      hasFileNamed(paths, 'setup.py') ||
      paths.some((p) => p.endsWith('.py')),
    tech: 'Python',
    message:
      "Python repos can't run here — WebContainer is a Node.js-only sandbox. Flask, Django, and FastAPI aren't supported.",
  },
  {
    match: (paths) => hasFileNamed(paths, 'pom.xml'),
    tech: 'Java (Maven)',
    message: "Java repos can't run here — WebContainer is a Node.js-only sandbox.",
  },
  {
    match: (paths) =>
      hasFileNamed(paths, 'build.gradle') || hasFileNamed(paths, 'build.gradle.kts'),
    tech: 'Java/Kotlin (Gradle)',
    message: "Java/Kotlin repos can't run here — WebContainer is a Node.js-only sandbox.",
  },
  {
    match: (paths) => hasFileNamed(paths, 'Gemfile'),
    tech: 'Ruby',
    message:
      "Ruby repos can't run here — WebContainer is a Node.js-only sandbox. Rails and Sinatra aren't supported.",
  },
  {
    match: (paths) => hasFileNamed(paths, 'go.mod'),
    tech: 'Go',
    message: "Go repos can't run here — WebContainer is a Node.js-only sandbox.",
  },
  {
    match: (paths) => hasFileNamed(paths, 'Cargo.toml'),
    tech: 'Rust',
    message: "Rust repos can't run here — WebContainer is a Node.js-only sandbox.",
  },
];

/**
 * Scans a list of repo file paths for markers of runtimes that can't run
 * inside WebContainer (which is Node.js-only). Returns the first match, or
 * null if the repo looks like a Node/JS project (or is unrecognized).
 */
export function detectUnsupportedTech(filePaths: string[]): UnsupportedTech | null {
  for (const check of CHECKS) {
    if (check.match(filePaths)) {
      return { tech: check.tech, message: check.message };
    }
  }
  return null;
}
