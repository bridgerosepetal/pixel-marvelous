(() => {
  const PM = globalThis.__pm;
  if (PM.store) return;
  const UI_KEY = 'pm:ui';
  const BP_KEY = 'pm:breakpoints';
  const SETTINGS_KEY = 'pm:settings';
  const imgKey = (id) => 'pm:img:' + id;
  const local = () => chrome.storage.local;

  PM.DEFAULT_BREAKPOINTS = [
    { id: 'mobile', name: 'Mobile', min: 0 },
    { id: 'tablet', name: 'Tablet', min: 768 },
    { id: 'desktop', name: 'Desktop', min: 1024 },
  ];

  const store = (PM.store = {
    site: { open: false, hidden: false },
    page: { v: 3, layers: [] },
    ui: { x: null, y: 16, collapsed: false },
    breakpoints: structuredClone(PM.DEFAULT_BREAKPOINTS),
    settings: { defaultBp: 'mobile' },
    path: location.pathname,
    siteKey: 'pm:site:' + location.origin,
    pageKey: () => 'pm:page:' + location.origin + store.path,

    normalizePage(raw) {
      return { v: 3, layers: PM.migrate(raw) };
    },

    setBreakpoints(list) {
      const sorted = list
        .filter((b) => b && b.id && Number.isFinite(b.min))
        .map((b) => ({ id: b.id, name: String(b.name || 'Device'), min: Math.max(0, Math.round(b.min)) }))
        .sort((a, b) => a.min - b.min);
      if (!sorted.length) sorted.push(...structuredClone(PM.DEFAULT_BREAKPOINTS));
      sorted[0].min = 0;
      store.breakpoints = sorted;
    },

    async load() {
      const pk = store.pageKey();
      const got = await local().get([pk, store.siteKey, UI_KEY, BP_KEY, SETTINGS_KEY]);
      if (got[BP_KEY]) store.setBreakpoints(got[BP_KEY]);
      Object.assign(store.settings, got[SETTINGS_KEY]);
      store.page = store.normalizePage(got[pk]);
      Object.assign(store.site, got[store.siteKey]);
      Object.assign(store.ui, got[UI_KEY]);
    },

    async switchPath(path) {
      await store.flush();
      store.path = path;
      const pk = store.pageKey();
      const got = await local().get(pk);
      store.page = store.normalizePage(got[pk]);
    },

    save: PM.debounce(() => store.flush(), 150),

    async flush() {
      if (!PM.alive()) return;
      const pk = store.pageKey();
      try {
        if (store.page.layers.length) await local().set({ [pk]: store.page });
        else await local().remove(pk);
        await local().set({
          [store.siteKey]: store.site,
          [UI_KEY]: store.ui,
          [BP_KEY]: store.breakpoints,
          [SETTINGS_KEY]: store.settings,
        });
      } catch (err) {
        console.warn('[pixel marvelous] could not save', err);
      }
    },

    putImage: (id, dataUrl) => local().set({ [imgKey(id)]: dataUrl }),

    async readImages(ids) {
      const got = await local().get(ids.map(imgKey));
      const out = {};
      for (const id of ids) if (got[imgKey(id)]) out[id] = got[imgKey(id)];
      return out;
    },

    removeImages(ids) {
      if (PM.alive() && ids.length) local().remove(ids.map(imgKey)).catch(() => {});
    },

    BP_KEY,
    SETTINGS_KEY,
  });

  const FLAT_KEYS = ['img', 'w', 'h', 'x', 'y', 'scale', 'opacity', 'blend', 'mode', 'anchor'];

  function toVariants(n, bp) {
    if (n.variants) return n;
    const variant = { id: PM.uid(), bp: bp.id, min: bp.min };
    for (const k of FLAT_KEYS) if (n[k] !== undefined) variant[k] = n[k];
    return {
      id: n.id,
      type: 'image',
      name: n.name,
      visible: n.visible !== false,
      locked: !!n.locked,
      variants: [PM.model.newVariant(variant)],
    };
  }

  const upgrade = (n, bp) =>
    n.type === 'group' ? { ...n, children: (n.children || []).map((c) => toVariants(c, bp)) } : toVariants(n, bp);

  PM.migrate = (raw, resolve) => {
    if (!raw) return [];
    const base = store.breakpoints[0];
    if (Array.isArray(raw.layers)) return raw.layers.map((n) => upgrade(n, base));
    if (raw.states) {
      const known = resolve || ((id) => store.breakpoints.find((b) => b.id === id) || { id: null, min: 0 });
      return Object.entries(raw.states)
        .map(([id, state]) => ({ bp: known(id), layers: state?.layers || [] }))
        .sort((a, b) => b.bp.min - a.bp.min)
        .flatMap(({ bp, layers }) => layers.map((n) => upgrade(n, bp)));
    }
    return [];
  };

  const urls = new Map();
  const loading = new Set();

  PM.toBlob = (dataUrl) => {
    const [head, b64] = dataUrl.split(',');
    const mime = (head.match(/^data:([^;,]+)/) || [])[1] || 'image/png';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  };

  PM.imageUrl = (id) => urls.get(id);
  PM.setImageUrl = (id, url) => urls.set(id, url);

  PM.ensureImage = (id) => {
    if (!id || urls.has(id) || loading.has(id)) return;
    loading.add(id);
    local()
      .get(imgKey(id))
      .then((got) => {
        const data = got[imgKey(id)];
        urls.set(id, data ? URL.createObjectURL(PM.toBlob(data)) : null);
      })
      .catch(() => urls.set(id, null))
      .finally(() => {
        loading.delete(id);
        PM.app?.imagesReady();
      });
  };
})();
