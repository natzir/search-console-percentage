import { describe, it, expect } from 'vitest';
import { WELCOME_PAGE, iconClicked, installed } from '../src/worker.js';

const fakeApi = ({ refuse = false } = {}) => {
  const calls = { created: [], sent: [] };
  return {
    calls,
    tabs: {
      async create(props) { calls.created.push(props); },
      async sendMessage(tabId, message) {
        if (refuse) throw new Error('Could not establish connection. Receiving end does not exist.');
        calls.sent.push([tabId, message]);
      },
    },
  };
};

describe('worker', () => {
  it('opens the welcome page on first install, not on later updates', async () => {
    const api = fakeApi();
    await installed({ reason: 'install' }, api);
    for (const reason of ['update', 'chrome_update', 'shared_module_update']) await installed({ reason }, api);
    await installed({ reason: 'update', previousVersion: '1.0.0' }, api);
    await installed({ reason: 'update', previousVersion: '10.0.0' }, api);
    expect(api.calls.created).toEqual([{ url: WELCOME_PAGE }]);
  });

  it('opens it on the update from 0.x, where the icon ran the extension (now it turns it off)', async () => {
    const api = fakeApi();
    await installed({ reason: 'update', previousVersion: '0.0.0.1' }, api);
    expect(api.calls.created).toEqual([{ url: WELCOME_PAGE }]);
  });

  it('tells the tab to turn on or off when the icon is clicked', async () => {
    const api = fakeApi();
    await iconClicked({ id: 7 }, api);
    expect(api.calls.sent).toEqual([[7, { type: 'scpc-toggle' }]]);
  });

  it('stays silent on tabs without the extension (other sites, Search Console opened before install)', async () => {
    await expect(iconClicked({ id: 7 }, fakeApi({ refuse: true }))).resolves.toBeUndefined();
  });
});
