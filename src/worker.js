// The service worker's logic; it takes the Chrome APIs as `api` so tests pass a fake.
export const WELCOME_PAGE = 'welcome.html';

export async function installed(details, api) {
  if (details.reason === 'install') await api.tabs.create({ url: WELCOME_PAGE });
}

// The icon turns the extension off and on in that tab. Tabs without it (other sites, Search Console
// opened before the install) don't answer, and there is nothing to say there.
export async function iconClicked(tab, api) {
  if (tab?.id === undefined) return;
  await api.tabs.sendMessage(tab.id, { type: 'scpc-toggle' }).catch(() => {});
}
