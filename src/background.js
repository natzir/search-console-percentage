// The service worker: wires Chrome's events to worker.js.
import { iconClicked, installed } from './worker.js';

const report = error => console.error('[Search Console Percentage Calculator]', error);

chrome.runtime.onInstalled.addListener(details => installed(details, chrome).catch(report));
chrome.action.onClicked.addListener(tab => iconClicked(tab, chrome).catch(report));
