import { WebContainer } from '@webcontainer/api';

const logEl = document.querySelector('#log');
const iframeEl = document.querySelector('#preview');

function log(line) {
  logEl.textContent += `\n${line}`;
  console.log(line);
}

async function main() {
  logEl.textContent = '';

  if (!window.crossOriginIsolated) {
    log('ERROR: not cross-origin isolated — check the COOP/COEP headers in vite.config.js.');
    return;
  }

  log('booting WebContainer…');
  const webcontainerInstance = await WebContainer.boot();
  log('booted.');

  // Same idea as the hello-world spike, but this page pulls in a real
  // cross-origin image — the shape a real repo's dev server output takes.
  await webcontainerInstance.mount({
    'server.js': {
      file: {
        contents: `
import { createServer } from 'node:http';

const html = \`<!doctype html>
<body style="font-family: system-ui">
  <h1>External asset test</h1>
  <img src="https://avatars.githubusercontent.com/u/583231?v=4" width="80" height="80" alt="octocat avatar" />
</body>\`;

createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(8080, () => {
  console.log('listening on 8080');
});
`,
      },
    },
  });
  log('mounted server.js.');

  webcontainerInstance.on('server-ready', (port, url) => {
    log(`server-ready — port ${port}, url ${url}`);
    iframeEl.src = url;
  });

  const serverProcess = await webcontainerInstance.spawn('node', ['server.js']);
  serverProcess.output.pipeTo(
    new WritableStream({
      write(data) {
        log(`[node] ${data}`);
      },
    }),
  );
}

main().catch((err) => {
  log(`ERROR: ${err.message}`);
  console.error(err);
});
