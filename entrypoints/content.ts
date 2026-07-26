export default defineContentScript({
  matches: ['*://github.com/*'],
  main() {
    console.log('Stackyard content script loaded.');
  },
});
