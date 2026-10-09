// Entry: runs on every Search Console page (Performance is often reached without a page load) and
// acts on Performance reports. The extension's icon turns it off and on in this tab.
import { start } from './app.js';

const app = start(document, window, { storage: chrome.storage.local });

chrome.runtime.onMessage.addListener(message => {
  if (message?.type === 'scpc-toggle') app.toggle();
});
