export default defineBackground(() => {
  console.log('Stackyard background service worker started.', { id: browser.runtime.id });
});
