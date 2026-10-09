// The service worker's logic; it takes the Chrome APIs as `api` so tests pass a fake.
export const WELCOME_PAGE = 'welcome.html';

// The welcome page opens on first install, and on the update from 0.x: there a click on the icon ran the
// extension, now it works by itself and the icon turns it off.
export async function installed(details, api) {
  const fromZero = details.reason === 'update' && /^0\./.test(details.previousVersion ?? '');
  if (details.reason === 'install' || fromZero) await api.tabs.create({ url: WELCOME_PAGE });
}

// The icon turns the extension off and on in that tab. Tabs without it (other sites, Search Console
// opened before the install) don't answer, and there is nothing to say there.
export async function iconClicked(tab, api) {
  if (tab?.id === undefined) return;
  await api.tabs.sendMessage(tab.id, { type: 'scpc-toggle' }).catch(() => {});
}
