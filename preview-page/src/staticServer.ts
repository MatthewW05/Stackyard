// Minimal Node.js HTTP server injected into the WebContainer filesystem for
// static site repos (no package.json). Runs via `node stackyard-static-server.js`.
export const STATIC_SERVER_SCRIPT = `
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  // Prefix with '.' to make the path relative to the process CWD (the
  // WebContainer project root). Absolute paths like '/index.html' resolve
  // against the container OS root (/bin, /etc, ...), not the project files.
  const base = '.' + urlPath;
  const filePath = (urlPath === '/' || urlPath.endsWith('/'))
    ? path.join(base, 'index.html')
    : base;

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
}).listen(3000);
`.trim();

/**
 * Returns true if the mounted WebContainer filesystem has an /index.html,
 * indicating this is a static site that can be served without npm.
 */
export async function hasStaticEntry(fs: {
  readFile: (path: string, encoding: string) => Promise<string>;
}): Promise<boolean> {
  try {
    await fs.readFile('/index.html', 'utf-8');
    return true;
  } catch {
    return false;
  }
}
