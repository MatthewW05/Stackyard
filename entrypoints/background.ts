import { OPEN_PREVIEW_MESSAGE, type OpenPreviewMessage } from '@/utils/messages';

export default defineBackground(() => {
  console.log('Stackyard background service worker started.', { id: browser.runtime.id });

  browser.runtime.onMessage.addListener((message: OpenPreviewMessage) => {
    if (message?.type === OPEN_PREVIEW_MESSAGE) {
      browser.tabs.create({ url: message.url });
    }
  });
});
