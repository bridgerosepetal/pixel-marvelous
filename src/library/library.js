const IMAGE_RE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const STATE_RE = /\.json$/i;
const STATE_SUFFIX = '.pixel.json';
const SCRIPTS = chrome.runtime.getManifest().content_scripts[0].js;

const $ = (sel) => document.querySelector(sel);

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const k in props || {}) {
    const v = props[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid);
  return el;
}

const ICONS = {
  chevron: '<path d="M6.5 3.5 11 8l-4.5 4.5"/>',
  folder: '<path d="M1.75 4.25c0-.55.45-1 1-1h3.1l1.5 1.5h5.9c.55 0 1 .45 1 1v6.5c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1Z"/>',
  doc: '<path d="M4 1.75h5l3 3v9.5H4Z"/><path d="M9 1.75v3h3M6 8.5h4M6 11h4"/>',
  refresh: '<path d="M13 3.5v3h-3"/><path d="M12.6 6.5A5 5 0 1 0 12.5 10"/>',
  close: '<path d="M4 4l8 8M12 4l-8 8"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  save: '<path d="M8 2.5v8M4.75 7.25 8 10.5l3.25-3.25"/><path d="M2.75 12.5v.25c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1v-.25"/>',
};

function icon(name, cls = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 16 16');
  s.setAttribute('width', '16');
  s.setAttribute('height', '16');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = ICONS[name];
  return s;
}

const ib = (name, title, onclick, cls = '') =>
  h('button', { class: 'ib ' + cls, title, 'aria-label': title, onclick: (e) => { e.stopPropagation(); onclick(e); } }, icon(name));

const btn = (label, onclick, cls = '', title) => h('button', { class: 'btn ' + cls, title, onclick }, label);

let statusTimer = 0;
function status(msg) {
  const el = $('#status');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

const readDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const slug = (s) =>
  s.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'page';

const stateName = (file) => file.replace(/\.pixel\.json$/i, '').replace(/\.json$/i, '');

const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('pixel-marvelous', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('collections', { keyPath: 'id' });
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function tx(mode, fn) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const t = db.transaction('collections', mode);
    const req = fn(t.objectStore('collections'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}

const loadAll = () => tx('readonly', (s) => s.getAll());
const save = (c) => tx('readwrite', (s) => s.put({ id: c.id, name: c.name, handle: c.handle, addedAt: c.addedAt }));
const forget = (id) => tx('readwrite', (s) => s.delete(id));

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(msg) {
  const tab = await activeTab();
  if (!tab?.id) throw new Error('There’s no page to put it on.');
  let res;
  try {
    res = await chrome.tabs.sendMessage(tab.id, msg);
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: SCRIPTS });
      res = await chrome.tabs.sendMessage(tab.id, msg);
    } catch {
      throw new Error('Pixel Marvelous can’t run on this page.');
    }
  }
  if (!res?.ok) throw new Error(res?.error || 'The page didn’t answer.');
  return res;
}

async function showTarget() {
  const tab = await activeTab().catch(() => null);
  const el = $('#target');
  let url = null;
  try {
    url = tab?.url ? new URL(tab.url) : null;
  } catch {}
  if (!url || !/^(https?|file):$/.test(url.protocol)) {
    el.textContent = 'Open a web page to place things on it.';
    return;
  }
  el.replaceChildren('Placing on ', h('b', null, (url.host || 'file') + url.pathname));
}

let collections = [];
const views = new Map();
const openIds = new Set(JSON.parse(localStorage.getItem('pm-open') || '[]'));
let objectUrls = [];

const viewOf = (id) => {
  if (!views.has(id)) views.set(id, { open: openIds.has(id), trail: [] });
  return views.get(id);
};

function rememberOpen() {
  const ids = collections.filter((c) => viewOf(c.id).open).map((c) => c.id);
  localStorage.setItem('pm-open', JSON.stringify(ids));
}

async function listDir(dir) {
  const folders = [];
  const images = [];
  const states = [];
  for await (const [name, handle] of dir.entries()) {
    if (name.startsWith('.')) continue;
    if (handle.kind === 'directory') folders.push({ name, handle });
    else if (IMAGE_RE.test(name)) images.push({ name, handle });
    else if (STATE_RE.test(name)) states.push({ name, handle });
  }
  return { folders: folders.sort(byName), images: images.sort(byName), states: states.sort(byName) };
}

function render() {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls = [];
  const main = $('#collections');
  if (!collections.length) {
    const mark = document.querySelector('.top .mark').cloneNode(true);
    main.replaceChildren(
      h(
        'div',
        { class: 'empty' },
        mark,
        h('h2', null, 'Keep mockups in a folder'),
        h('p', null, 'Connect a folder from your computer. Its images and saved page states show up here, ready to drop onto any page.'),
        btn('Connect a folder', connect, 'primary'),
      ),
    );
    return;
  }
  main.replaceChildren(...collections.map(card));
}

function card(c) {
  const v = viewOf(c.id);
  const toggle = () => {
    v.open = !v.open;
    rememberOpen();
    render();
  };
  const head = h(
    'div',
    { class: 'col-head', role: 'button', tabindex: '0', 'aria-expanded': String(v.open), onclick: toggle, onkeydown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()) },
    icon('chevron', 'chev'),
    icon('folder'),
    h('span', { class: 'col-name', title: c.name }, c.name),
    ib('refresh', 'Refresh', render),
    ib('close', 'Disconnect (the folder stays on your disk)', () => disconnect(c), 'danger'),
  );
  const body = h('div', { class: 'col-body' });
  if (v.open) fill(c, v, body);
  return h('section', { class: 'col' + (v.open ? ' open' : '') }, head, v.open ? body : null);
}

async function fill(c, v, body) {
  let perm = 'prompt';
  try {
    perm = await c.handle.queryPermission({ mode: 'readwrite' });
  } catch {}
  if (perm !== 'granted') {
    body.replaceChildren(
      h(
        'div',
        { class: 'reconnect' },
        h('span', null, 'Chrome needs your OK to open this folder again.'),
        btn('Allow', async () => {
          try {
            if ((await c.handle.requestPermission({ mode: 'readwrite' })) === 'granted') render();
          } catch (err) {
            status(err.message);
          }
        }, 'primary small'),
      ),
    );
    return;
  }

  const dir = v.trail.length ? v.trail[v.trail.length - 1].handle : c.handle;
  let listing;
  try {
    listing = await listDir(dir);
  } catch (err) {
    body.replaceChildren(h('p', { class: 'note' }, `Couldn’t read this folder: ${err.message}`));
    return;
  }
  const { folders, images, states } = listing;
  const parts = [];

  if (v.trail.length) {
    parts.push(
      h(
        'nav',
        { class: 'crumbs' },
        h('button', { onclick: () => { v.trail = []; render(); } }, c.name),
        v.trail.map((t, i) =>
          i === v.trail.length - 1
            ? ['/', h('span', { class: 'here' }, t.name)]
            : ['/', h('button', { onclick: () => { v.trail = v.trail.slice(0, i + 1); render(); } }, t.name)],
        ),
      ),
    );
  }

  parts.push(h('div', { class: 'section' }, 'Saved states'));
  for (const s of states) {
    parts.push(
      h(
        'div',
        { class: 'item state' },
        icon('doc', 'doc'),
        h('span', { class: 'name', title: s.name }, stateName(s.name)),
        ib('save', 'Save the current page over this file', () => saveState(dir, s.name, true)),
        btn('Load', () => loadState(s), 'small', 'Replace the page’s layers with this state'),
      ),
    );
  }
  parts.push(saveRow(dir, states));

  if (folders.length) {
    parts.push(h('div', { class: 'section' }, 'Folders'));
    for (const f of folders) {
      parts.push(
        h(
          'div',
          { class: 'item folder', role: 'button', tabindex: '0', onclick: () => { v.trail = [...v.trail, f]; render(); } },
          icon('folder'),
          h('span', { class: 'name' }, f.name),
          icon('chevron'),
        ),
      );
    }
  }

  if (images.length) {
    parts.push(h('div', { class: 'section' }, `Images · ${images.length}`));
    parts.push(h('div', { class: 'grid' }, images.map(tile)));
  } else if (!folders.length) {
    parts.push(h('p', { class: 'note' }, 'No images here yet. Put PNG, JPG, WebP or SVG mockups in this folder and refresh.'));
  }

  body.replaceChildren(...parts);
}

function saveRow(dir, states) {
  let armed = null;
  const input = h('input', { 'aria-label': 'State name', spellcheck: 'false', placeholder: 'name' });
  const go = h('button', { class: 'btn small primary', title: 'Save the current page’s layers into this folder' }, 'Save page');
  const suffix = h('span', { class: 'suffix' }, STATE_SUFFIX);

  activeTab().then((tab) => {
    try {
      const u = new URL(tab.url);
      input.value = slug(u.hostname + u.pathname);
    } catch {}
  });

  input.addEventListener('input', () => {
    armed = null;
    go.textContent = 'Save page';
  });
  input.addEventListener('keydown', (e) => e.key === 'Enter' && go.click());
  go.addEventListener('click', async () => {
    const name = input.value.trim().replace(/\.pixel\.json$|\.json$/i, '');
    if (!name) return input.focus();
    const file = name + STATE_SUFFIX;
    if (armed !== file && states.some((s) => s.name === file)) {
      armed = file;
      go.textContent = 'Replace';
      status(`${file} already exists. Click Replace to overwrite it.`);
      return;
    }
    await saveState(dir, file, true);
  });
  return h('div', { class: 'save' }, input, suffix, go);
}

function tile(img) {
  const pic = h('span', { class: 'pic' });
  const el = h(
    'button',
    { class: 'tile', title: `Place ${img.name} on the page`, onclick: () => addImage(img, el) },
    pic,
    h('span', { class: 'label' }, img.name),
  );
  pic.append(h('span', { class: 'add' }, icon('plus'), 'Place'));
  img.handle
    .getFile()
    .then((file) => {
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      pic.prepend(h('img', { src: url, alt: '', loading: 'lazy' }));
    })
    .catch(() => {});
  return el;
}

async function connect() {
  let handle;
  try {
    handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'pixel-marvelous' });
  } catch (err) {
    if (err.name !== 'AbortError') status(err.message);
    return;
  }
  for (const c of collections) {
    if (await c.handle.isSameEntry(handle)) {
      viewOf(c.id).open = true;
      rememberOpen();
      render();
      status(`${c.name} is already connected.`);
      return;
    }
  }
  const c = { id: crypto.randomUUID(), name: handle.name, handle, addedAt: Date.now() };
  await save(c);
  collections.push(c);
  collections.sort(byName);
  viewOf(c.id).open = true;
  rememberOpen();
  render();
}

async function disconnect(c) {
  await forget(c.id);
  collections = collections.filter((x) => x !== c);
  views.delete(c.id);
  rememberOpen();
  render();
  status(`Disconnected ${c.name}. Nothing was deleted.`);
}

async function addImage(img, el) {
  el.classList.add('busy');
  try {
    const file = await img.handle.getFile();
    await send({ type: 'pm:add-image', name: file.name, dataUrl: await readDataUrl(file) });
    status(`Placed ${img.name}.`);
  } catch (err) {
    status(err.message);
  } finally {
    el.classList.remove('busy');
  }
}

async function loadState(s) {
  try {
    const data = JSON.parse(await (await s.handle.getFile()).text());
    if (data?.format !== 'pixel-marvelous') throw new Error(`${s.name} isn’t a Pixel Marvelous state.`);
    await send({ type: 'pm:import', data, name: stateName(s.name) });
    status(`Loaded ${stateName(s.name)}.`);
  } catch (err) {
    status(err instanceof SyntaxError ? `${s.name} isn’t valid JSON.` : err.message);
  }
}

async function saveState(dir, file, overwrite) {
  try {
    const res = await send({ type: 'pm:snapshot' });
    const handle = await dir.getFileHandle(file, { create: overwrite });
    const out = await handle.createWritable();
    await out.write(JSON.stringify(res.data, null, 2));
    await out.close();
    status(`Saved ${stateName(file)}.`);
    render();
  } catch (err) {
    status(err.message);
  }
}

$('#connect').addEventListener('click', connect);
chrome.tabs.onActivated.addListener(showTarget);
chrome.tabs.onUpdated.addListener((_id, info) => (info.url || info.status === 'complete') && showTarget());
chrome.windows.onFocusChanged.addListener(showTarget);

(async () => {
  collections = ((await loadAll()) || []).sort(byName);
  render();
  showTarget();
})();
