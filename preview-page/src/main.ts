import { WebContainer } from '@webcontainer/api';
import { fetchRepoFiles } from './githubRepo';
import { buildFileSystemTree } from './fileSystemTree';
import { detectStartScript } from './devServer';

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

const repoStatus = document.createElement('p');
app.append(repoStatus);

const params = getRepoParams(location.search);
repoStatus.textContent = params
  ? `Preview: ${params.owner}/${params.repo}`
  : "Missing owner/repo query params. Open this page via the Stackyard extension's Preview button.";

const bootStatus = document.createElement('p');
app.append(bootStatus);

const mountStatus = document.createElement('p');
app.append(mountStatus);

const installStatus = document.createElement('p');
app.append(installStatus);

const installOutput = document.createElement('pre');
app.append(installOutput);

// WebContainer.boot() throws if called twice in the same page - cache the
// promise so any future re-entry reuses the same instance instead of
// re-booting. See WEBCONTAINER_SPIKE_NOTES.md.
let bootPromise: Promise<WebContainer> | null = null;

function bootWebContainer(): Promise<WebContainer> {
  if (!bootPromise) bootPromise = WebContainer.boot();
  return bootPromise;
}

async function initWebContainer() {
  if (!crossOriginIsolated) {
    bootStatus.textContent =
      'Cannot boot WebContainer: this page is not cross-origin isolated ' +
      '(crossOriginIsolated is false). Check that COOP/COEP headers are being served.';
    return;
  }

  bootStatus.textContent = 'Booting WebContainer...';
  try {
    const instance = await bootWebContainer();
    bootStatus.textContent = 'WebContainer ready.';
    if (params) await mountRepo(instance, params);
  } catch (error) {
    bootStatus.textContent = `Failed to boot WebContainer: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function mountRepo(instance: WebContainer, { owner, repo }: RepoParams): Promise<void> {
  mountStatus.textContent = `Fetching ${owner}/${repo} from GitHub...`;
  try {
    const files = await fetchRepoFiles(owner, repo);
    mountStatus.textContent = `Mounting ${files.length} files...`;

    const tree = buildFileSystemTree(files);
    await instance.mount(tree);

    mountStatus.textContent = `Mounted ${files.length} files.`;
  } catch (error) {
    mountStatus.textContent = `Failed to fetch/mount repo: ${error instanceof Error ? error.message : String(error)}`;
    return;
  }

  let packageJsonContent: string;
  try {
    packageJsonContent = await instance.fs.readFile('/package.json', 'utf-8');
  } catch {
    installStatus.textContent = 'No package.json found — nothing to install.';
    return;
  }

  const startScript = detectStartScript(packageJsonContent);
  if (!startScript) {
    installStatus.textContent = 'No recognized dev/start script in package.json.';
    return;
  }

  await runInstall(instance, startScript);
}

// Renders terminal output cleanly in a <pre>:
// - \x1b[nG (cursor-to-col-1, used by npm's spinner) is converted to \r first
//   so the overwrite logic below fires correctly.
// - \r\n is treated as a plain newline (Windows line ending), not a chop.
// - Bare \r overwrites the current line (carriage return semantics).
// - All remaining ANSI escape sequences are stripped.
function appendTerminalOutput(element: HTMLPreElement, chunk: string): void {
  const withCR = chunk.replace(/\x1b\[\d*G/g, '\r');
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

async function runInstall(instance: WebContainer, startScript: string): Promise<void> {
  installStatus.textContent = 'Running npm install...';
  const process = await instance.spawn('npm', ['install']);
  process.output.pipeTo(
    new WritableStream({
      write(chunk) {
        appendTerminalOutput(installOutput, chunk);
      },
    }),
  );

  const exitCode = await process.exit;
  if (exitCode !== 0) {
    installStatus.textContent = `npm install failed (exit ${exitCode}).`;
    return;
  }

  installStatus.textContent = `npm install done. Starting ${startScript}...`;
}

void initWebContainer();
