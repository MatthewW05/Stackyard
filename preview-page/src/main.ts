import { WebContainer } from '@webcontainer/api';

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
    await bootWebContainer();
    bootStatus.textContent = 'WebContainer ready.';
  } catch (error) {
    bootStatus.textContent = `Failed to boot WebContainer: ${error instanceof Error ? error.message : String(error)}`;
  }
}

void initWebContainer();
