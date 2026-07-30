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
const status = document.createElement('p');
app.append(status);

const params = getRepoParams(location.search);
status.textContent = params
  ? `Preview: ${params.owner}/${params.repo}`
  : "Missing owner/repo query params. Open this page via the Stackyard extension's Preview button.";
