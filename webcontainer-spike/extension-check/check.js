const log = document.querySelector('#log');
log.textContent = [
  `crossOriginIsolated: ${window.crossOriginIsolated}`,
  `SharedArrayBuffer available: ${typeof SharedArrayBuffer !== 'undefined'}`,
].join('\n');
