const SCRIPTS = chrome.runtime.getManifest().content_scripts[0].js;
const INK = '#22201c';
const ACCENT = '#e5532d';

function drawIcon(size) {
  const canvas = new OffscreenCanvas(size, size);
  const g = canvas.getContext('2d');
  g.scale(size / 16, size / 16);
  g.lineWidth = 1.6;
  g.strokeStyle = INK;
  g.beginPath();
  g.roundRect(1.3, 1.3, 9.2, 9.2, 2);
  g.stroke();
  g.globalAlpha = 0.94;
  g.fillStyle = ACCENT;
  g.beginPath();
  g.roundRect(5.5, 5.5, 9.2, 9.2, 2);
  g.fill();
  return g.getImageData(0, 0, size, size);
}

function paintIcon() {
  try {
    chrome.action.setIcon({ imageData: { 16: drawIcon(16), 32: drawIcon(32), 48: drawIcon(48) } });
  } catch (err) {
    console.warn('Could not draw icon', err);
  }
  chrome.action.setBadgeBackgroundColor({ color: INK });
  chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
}

async function collectGarbage() {
  if (!chrome.storage.local.getKeys) return;
  const keys = await chrome.storage.local.getKeys();
  const pages = await chrome.storage.local.get(keys.filter((k) => k.startsWith('pm:page:')));
  const used = new Set();
  const walk = (node) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object') {
      if (typeof node.img === 'string') used.add(node.img);
      Object.values(node).forEach(walk);
    }
  };
  walk(Object.values(pages));
  const orphans = keys.filter((k) => k.startsWith('pm:img:') && !used.has(k.slice(7)));
  if (orphans.length) await chrome.storage.local.remove(orphans);
}

async function flashUnavailable(tabId) {
  await chrome.action.setBadgeText({ tabId, text: '×' });
  await chrome.action.setTitle({ tabId, title: 'Pixel Marvelous can’t run on this page' });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: 'Pixel Marvelous' }).catch(() => {});
  }, 2000);
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'pm:toggle' });
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: SCRIPTS });
      await chrome.tabs.sendMessage(tab.id, { type: 'pm:toggle' });
    } catch {
      flashUnavailable(tab.id);
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!sender.tab?.id) return;
  if (msg?.type === 'pm:badge') {
    const text = msg.on ? (msg.count ? String(msg.count) : '•') : '';
    chrome.action.setBadgeText({ tabId: sender.tab.id, text }).catch(() => {});
  } else if (msg?.type === 'pm:open-library') {
    chrome.sidePanel
      .open({ windowId: sender.tab.windowId })
      .then(() => reply({ ok: true }), (err) => reply({ ok: false, error: err.message }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener(paintIcon);
chrome.runtime.onStartup.addListener(() => {
  paintIcon();
  collectGarbage().catch(() => {});
});
paintIcon();
