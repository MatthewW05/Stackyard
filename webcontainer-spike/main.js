import { WebContainer } from '@webcontainer/api';

const logEl = document.querySelector('#log');
const iframeEl = document.querySelector('#preview');

function log(line) {
  logEl.textContent += `\n${line}`;
  console.log(line);
}

async function main() {
  logEl.textContent = '';
  log(`crossOriginIsolated: ${window.crossOriginIsolated}`);
  log(`SharedArrayBuffer available: ${typeof SharedArrayBuffer !== 'undefined'}`);

  // WebContainer.boot() throws immediately if the page isn't cross-origin
  // isolated (crossOriginIsolated === false) — checking first gives a clear
  // error instead of an opaque one from inside the library.
  if (!window.crossOriginIsolated) {
    log('ERROR: not cross-origin isolated — check the COOP/COEP headers in vite.config.js.');
    return;
  }

  log('booting WebContainer…');
  const webcontainerInstance = await WebContainer.boot();
  log('booted.');

  // The "one hardcoded file": a plain Node http server, no dependencies,
  // so there's no npm install step to wait on for this spike.
  await webcontainerInstance.mount({
    'server.js': {
      file: {
        contents: `
import { createServer } from 'node:http';

const html = '<!doctype html><body style="font-family: system-ui"><h1>Hello from inside a WebContainer!</h1></body>';

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

  // WebContainers proxy the container's internal port to a real, unique URL
  // on this event — that URL is what the iframe below points at.
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
