import { WebContainer } from '@webcontainer/api';
import { fetchRepoFiles, GitHubFetchError } from './githubRepo';
import { buildFileSystemTree, type RepoFile } from './fileSystemTree';
import { detectStartScript, sanitizePackageJson } from './devServer';
import { locatePackageJson, type PackageJsonCandidate } from './packageJsonLocator';
import { hasStaticEntry, STATIC_SERVER_SCRIPT } from './staticServer';
import { detectUnsupportedTech } from './detectUnsupportedTech';
import { createStatusLine } from './status';
import { isExtensionMarkerPresent, waitForExtensionMarker } from './extensionGate';
import { renderInstallPrompt } from './installPrompt';
import { fetchRateLimitStatus, renderRateLimitStatus } from './rateLimit';
import './style.css';

interface RepoParams {
  owner: string;
  repo: string;
}

export function getRepoParams(search: string): RepoParams | null {
  const params = new URLSearchParams(search);
  const owner = params.get('owner');
  const repo = params.get('repo');
  if (!owner || !repo) return null;
  return { owner, repo };
}

const app = document.querySelector<HTMLDivElement>('#app')!;

async function main(): Promise<void> {
  const extensionDetected = await waitForExtensionMarker(isExtensionMarkerPresent);
  if (!extensionDetected) {
    renderInstallPrompt(app);
    return;
  }

  const repoStatus = document.createElement('p');
  app.append(repoStatus);

  const params = getRepoParams(location.search);
  repoStatus.textContent = params
    ? `Preview: ${params.owner}/${params.repo}`
    : "Missing owner/repo query params. Open this page via the Stackyard extension's Preview button.";

  // Non-blocking: doesn't gate WebContainer boot/mount below it. See
  // roadmap Phase 3, feature/github-cache-layer.
  const rateLimitContainer = document.createElement('div');
  app.append(rateLimitContainer);
  void fetchRateLimitStatus()
    .then((status) => renderRateLimitStatus(rateLimitContainer, status))
    .catch((error) => console.error('Failed to fetch GitHub rate limit status.', error));

  const bootStatus = createStatusLine();
  app.append(bootStatus.el);

  const mountStatus = createStatusLine();
  app.append(mountStatus.el);

  const installStatus = createStatusLine();
  app.append(installStatus.el);

  const installOutput = document.createElement('pre');
  app.append(installOutput);

  // WebContainer.boot() throws if called twice in the same page - cache the
  // promise so any future re-entry reuses the same instance instead of
  // re-booting. See WEBCONTAINER_NOTES.md.
  let bootPromise: Promise<WebContainer> | null = null;

  function bootWebContainer(): Promise<WebContainer> {
    if (!bootPromise) bootPromise = WebContainer.boot();
    return bootPromise;
  }

  async function initWebContainer() {
    if (!crossOriginIsolated) {
      bootStatus.set(
        'Cannot boot WebContainer: this page is not cross-origin isolated ' +
          '(crossOriginIsolated is false). Check that COOP/COEP headers are being served.',
        'error',
      );
      return;
    }

    bootStatus.set('Booting WebContainer...', 'loading');
    try {
      const instance = await bootWebContainer();
      bootStatus.set('WebContainer ready.', 'done');
      if (params) await mountRepo(instance, params);
    } catch (error) {
      bootStatus.set(
        `Failed to boot WebContainer: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }

  // GitHub-specific error classes already carry a friendly, specific message -
  // showing them as-is avoids a redundant "Failed to fetch/mount repo:" prefix
  // on top of a message that already explains what went wrong.
  function describeMountError(error: unknown): string {
    if (error instanceof GitHubFetchError) {
      return error.message;
    }
    return `Failed to fetch/mount repo: ${error instanceof Error ? error.message : String(error)}`;
  }

  async function mountRepo(instance: WebContainer, { owner, repo }: RepoParams): Promise<void> {
    mountStatus.set(`Fetching ${owner}/${repo} from GitHub...`, 'loading');
    let files: RepoFile[];
    try {
      files = await fetchRepoFiles(owner, repo);
      mountStatus.set(`Mounting ${files.length} files...`, 'loading');

      const tree = buildFileSystemTree(files);
      await instance.mount(tree);

      mountStatus.set(`Mounted ${files.length} files.`, 'done');
    } catch (error) {
      mountStatus.set(describeMountError(error), 'error');
      return;
    }

    const decoder = new TextDecoder();
    const packageJsonCandidates: PackageJsonCandidate[] = files
      .filter((f) => f.path === 'package.json' || f.path.endsWith('/package.json'))
      .map((f) => ({ path: f.path, content: decoder.decode(f.contents) }));

    const located = locatePackageJson(packageJsonCandidates);
    if (!located) {
      const unsupported = detectUnsupportedTech(files.map((f) => f.path));
      if (unsupported) {
        installStatus.set(`${unsupported.tech}: ${unsupported.message}`, 'error');
        return;
      }
      if (await hasStaticEntry(() => instance.fs.readFile('/index.html', 'utf-8'))) {
        installStatus.set('No package.json — detected static site.', 'done');
        await serveStatic(instance);
      } else {
        installStatus.set(
          'No package.json or index.html found — cannot preview this repo.',
          'error',
        );
      }
      return;
    }

    const cwd = located.dir || undefined;

    const sanitized = sanitizePackageJson(located.content);
    if (sanitized !== located.content) {
      try {
        await instance.fs.writeFile('/' + located.path, sanitized);
      } catch (error) {
        installStatus.set(
          `Failed to write sanitized package.json: ${error instanceof Error ? error.message : String(error)}`,
          'error',
        );
        return;
      }
    }

    const startScript = detectStartScript(sanitized);
    if (!startScript) {
      installStatus.set('No recognized dev/start script in package.json.', 'error');
      return;
    }

    const installOk = await runInstall(instance, cwd);
    if (!installOk) return;

    await startDevServer(instance, startScript, cwd);
  }

  // Renders terminal output cleanly in a <pre>:
  // - \x1b[nG (cursor-to-col-1, used by npm's spinner) is converted to \r first
  //   so the overwrite logic below fires correctly.
  // - \r\n is treated as a plain newline (Windows line ending), not a chop.
  // - Bare \r overwrites the current line (carriage return semantics).
  // - All remaining ANSI escape sequences are stripped.
  function appendTerminalOutput(element: HTMLPreElement, chunk: string): void {
    // eslint-disable-next-line no-control-regex
    const withCR = chunk.replace(/\x1b\[\d*G/g, '\r');
    // eslint-disable-next-line no-control-regex
    const stripped = withCR.replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

    let text = element.textContent ?? '';
    let i = 0;
    while (i < stripped.length) {
      const c = stripped[i];
      if (c === '\r' && stripped[i + 1] === '\n') {
        text += '\n';
        i += 2;
      } else if (c === '\r') {
        const lastNl = text.lastIndexOf('\n');
        text = text.slice(0, lastNl + 1);
        i++;
      } else {
        text += c;
        i++;
      }
    }
    element.textContent = text;
  }

  async function runInstall(instance: WebContainer, cwd?: string): Promise<boolean> {
    installStatus.set('Running npm install...', 'loading');
    try {
      const process = await instance.spawn('npm', ['install', '--legacy-peer-deps'], { cwd });
      process.output.pipeTo(
        new WritableStream({
          write(chunk) {
            appendTerminalOutput(installOutput, chunk);
          },
        }),
      );

      const exitCode = await process.exit;
      if (exitCode !== 0) {
        installStatus.set(`npm install failed (exit ${exitCode}).`, 'error');
        return false;
      }
    } catch (error) {
      installStatus.set(
        `Failed to run npm install: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
      return false;
    }

    installStatus.set('npm install done.', 'done');
    return true;
  }

  async function startDevServer(
    instance: WebContainer,
    startScript: string,
    cwd?: string,
  ): Promise<void> {
    const devStatus = createStatusLine();
    app.append(devStatus.el);

    const devOutput = document.createElement('pre');
    app.append(devOutput);

    const preview = document.createElement('iframe');
    preview.style.cssText = 'display:none; width:100%; height:80vh; border:1px solid #ccc;';
    app.append(preview);

    devStatus.set(`Starting npm run ${startScript}...`, 'loading');

    // Register server-ready before spawning so we never miss the event.
    instance.on('server-ready', (_port, url) => {
      devStatus.set('Server ready.', 'done');
      preview.src = url;
      preview.style.display = 'block';
    });

    try {
      const process = await instance.spawn('npm', ['run', startScript], { cwd });
      process.output.pipeTo(
        new WritableStream({
          write(chunk) {
            appendTerminalOutput(devOutput, chunk);
          },
        }),
      );

      const exitCode = await process.exit;
      if (exitCode !== 0) {
        devStatus.set(`npm run ${startScript} exited with code ${exitCode}.`, 'error');
      }
    } catch (error) {
      devStatus.set(
        `Failed to start npm run ${startScript}: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }

  async function serveStatic(instance: WebContainer): Promise<void> {
    const staticStatus = createStatusLine();
    app.append(staticStatus.el);

    const staticOutput = document.createElement('pre');
    app.append(staticOutput);

    const preview = document.createElement('iframe');
    preview.style.cssText = 'display:none; width:100%; height:80vh; border:1px solid #ccc;';
    app.append(preview);

    staticStatus.set('Starting static file server...', 'loading');

    instance.on('server-ready', (_port, url) => {
      staticStatus.set('Server ready.', 'done');
      preview.src = url;
      preview.style.display = 'block';
    });

    try {
      await instance.fs.writeFile('/stackyard-static-server.js', STATIC_SERVER_SCRIPT);

      const proc = await instance.spawn('node', ['stackyard-static-server.js']);
      proc.output.pipeTo(
        new WritableStream({
          write(chunk) {
            appendTerminalOutput(staticOutput, chunk);
          },
        }),
      );

      const exitCode = await proc.exit;
      if (exitCode !== 0) {
        staticStatus.set(`Static server exited with code ${exitCode}.`, 'error');
      }
    } catch (error) {
      staticStatus.set(
        `Failed to start static file server: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  }

  void initWebContainer();
}

void main();
