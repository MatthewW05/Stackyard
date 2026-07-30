import { WebContainer } from '@webcontainer/api';
import { fetchRepoFiles } from './githubRepo';
import { buildFileSystemTree } from './fileSystemTree';
import { listMountedFiles } from './listMountedFiles';

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

const fileList = document.createElement('pre');
app.append(fileList);

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

    const mountedPaths = await listMountedFiles(instance.fs);
    mountStatus.textContent = `Mounted ${mountedPaths.length} files.`;
    fileList.textContent = mountedPaths.join('\n');
  } catch (error) {
    mountStatus.textContent = `Failed to fetch/mount repo: ${error instanceof Error ? error.message : String(error)}`;
  }
}

void initWebContainer();
