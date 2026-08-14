import { WebContainer } from '@webcontainer/api';

// A real Vite dev server, not a zero-dependency node:http server (the
// original hello-world spike's trick). Firefox's WebContainer proxy served
// a persistent `.localservice@no-server` fallback for the bare node:http
// server regardless of COEP mode (confirmed identical under both
// require-corp and credentialless via network logging) - a bug in that
// minimal harness, not a credentialless-specific finding. The real
// preview-page app already works in Firefox via a real npm-installed dev
// server, so this mirrors that proven path instead.
//
// Two images: `control` sends Cross-Origin-Resource-Policy: cross-origin
// (confirmed via curl -I), so it should load under both require-corp and
// credentialless - if it ever fails, the harness itself is broken, not the
// thing under test. `test` sends no CORP header at all (also confirmed via
// curl -I), which is the real case require-corp blocks and credentialless
// is supposed to unblock - that's the actual unknown.
const INDEX_HTML = `<!doctype html>
<html>
<body>
  <p id="control-status">control: pending</p>
  <p id="test-status">test: pending</p>
  <img id="control-img" src="https://avatars.githubusercontent.com/u/9919" width="80" height="80" />
  <img id="test-img" src="https://placehold.co/200x200.png" width="80" height="80" />
  <script>
    function wire(imgId, statusId, label) {
      var img = document.getElementById(imgId);
      var status = document.getElementById(statusId);
      img.onload = function () { status.textContent = label + ': loaded'; };
      img.onerror = function () { status.textContent = label + ': blocked'; };
    }
    wire('control-img', 'control-status', 'control');
    wire('test-img', 'test-status', 'test');
  </script>
</body>
</html>
`;

const PACKAGE_JSON = JSON.stringify(
  {
    name: 'credentialless-fixture',
    private: true,
    type: 'module',
    scripts: { dev: 'vite --port 3111 --strictPort' },
    devDependencies: { vite: '^5.4.0' },
  },
  null,
  2,
);

const coi = document.getElementById('coi');
const bootStatus = document.getElementById('boot-status');
const installStatus = document.getElementById('install-status');
const preview = document.getElementById('preview');

coi.textContent = String(window.crossOriginIsolated);

// WebContainer.boot() does not infer this from the page's own COEP header -
// it defaults to require-corp-style proxying unless told otherwise, and the
// value can't be changed on a later reboot. See @webcontainer/api's
// BootOptions.coep.
const COEP_MODE = import.meta.env.VITE_COEP_MODE;

async function main() {
  if (!window.crossOriginIsolated) {
    bootStatus.textContent = 'error: not cross-origin isolated';
    return;
  }

  try {
    bootStatus.textContent = 'booting';
    const instance = await WebContainer.boot({ coep: COEP_MODE });
    await instance.mount({
      'package.json': { file: { contents: PACKAGE_JSON } },
      'index.html': { file: { contents: INDEX_HTML } },
    });
    bootStatus.textContent = 'ready';

    installStatus.textContent = 'npm install...';
    const install = await instance.spawn('npm', ['install']);
    const installExit = await install.exit;
    if (installExit !== 0) {
      installStatus.textContent = `npm install failed (${installExit})`;
      return;
    }
    installStatus.textContent = 'npm install done';

    instance.on('server-ready', (_port, url) => {
      preview.src = url;
    });

    await instance.spawn('npm', ['run', 'dev']);
  } catch (error) {
    bootStatus.textContent = `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

void main();
