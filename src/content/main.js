(() => {
  const PM = globalThis.__pm;
  if (PM.app) return;

  PM.ui = { selected: null, variant: null, group: null, picking: false, view: 'layers' };

  let mounted = false;
  let torn = false;
  let raf = 0;
  let observer = null;
  let routing = false;
  let lastWidth = innerWidth;
  let lastKey = '';
  const ready = PM.store.load().catch(() => {});

  function mount() {
    if (mounted) return;
    mounted = true;
    for (const stale of document.querySelectorAll('pixel-marvelous')) stale.remove();

    const host = document.createElement('pixel-marvelous');
    const root = host.attachShadow({ mode: 'closed' });
    const wrap = PM.h('div', { class: 'pm' });
    root.append(PM.h('style', null, PM.css), wrap);
    PM.host = host;
    PM.root = root;
    PM.wrap = wrap;
    PM.stage.mount(wrap);
    PM.panel.mount(wrap);
    document.documentElement.append(host);

    observer = new MutationObserver(() => {
      if (!host.isConnected && !torn) document.documentElement.append(host);
    });
    observer.observe(document.documentElement, { childList: true });
  }

  function loop() {
    raf = 0;
    if (!PM.alive()) return teardown();
    if (!PM.store.site.open) return;
    if (innerWidth !== lastWidth) onResize();
    PM.stage.frame();
    raf = requestAnimationFrame(loop);
  }
  const startLoop = () => {
    if (!raf) raf = requestAnimationFrame(loop);
  };

  function teardown() {
    if (torn) return;
    torn = true;
    cancelAnimationFrame(raf);
    clearInterval(routeTimer);
    removeEventListener('keydown', onKey, true);
    removeEventListener('paste', onPaste, true);
    removeEventListener('resize', onResize);
    observer?.disconnect();
    PM.host?.remove();
  }

  function badge() {
    if (!PM.alive()) return;
    chrome.runtime
      .sendMessage({ type: 'pm:badge', on: PM.store.site.open, count: PM.model.images().length })
      .catch(() => {});
  }

  const naturalSize = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || 300, h: img.naturalHeight || 150 });
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const readDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const baseName = (name) => {
    const base = (name || '').replace(/^.*[\\/]/, '').replace(/\.[a-z0-9]+$/i, '');
    return !base || base === 'image' ? 'Pasted image' : base;
  };

  const currentGroup = () => (PM.ui.group ? PM.model.find(PM.ui.group)?.node || null : null);

  function editing(id = PM.ui.selected) {
    const f = PM.model.find(id);
    if (!f || f.node.type !== 'image') return null;
    return { ...f, v: PM.variants.target(f.node) };
  }

  async function ingest(file) {
    const url = URL.createObjectURL(file);
    const size = await naturalSize(url);
    if (!size) {
      URL.revokeObjectURL(url);
      PM.panel.toast(`Couldn’t read ${file.name || 'that image'}.`);
      return null;
    }
    const imgId = PM.uid();
    try {
      await PM.store.putImage(imgId, await readDataUrl(file));
    } catch {
      URL.revokeObjectURL(url);
      PM.panel.toast('Couldn’t store that image.');
      return null;
    }
    PM.setImageUrl(imgId, url);
    return { imgId, ...size };
  }

  function releaseImages(ids) {
    const used = PM.model.usedImages();
    PM.store.removeImages(ids.filter((id) => !used.has(id)));
  }

  function pick(onPick) {
    PM.ui.picking = true;
    PM.wrap.classList.add('picking');
    app.changed('view');
    const done = () => {
      PM.ui.picking = false;
      PM.wrap.classList.remove('picking');
      app.changed('view');
    };
    PM.picker.start({
      onPick: (el) => {
        done();
        onPick(el);
      },
      onCancel: done,
    });
  }

  async function ensureOpen() {
    await ready;
    if (!PM.store.site.open) await app.toggle(true);
  }

  function keepInPlace(v, group, change) {
    const r = PM.geo.rect(v, group);
    change();
    if (r) PM.geo.place(v, group, r.left, r.top);
  }

  const app = (PM.app = {
    changed(kind = 'struct') {
      if (kind !== 'view') PM.store.save();
      lastWidth = innerWidth;
      lastKey = PM.variants.key();
      PM.stage.sync();
      if (kind === 'value') PM.panel.refresh();
      else {
        PM.panel.render();
        badge();
      }
    },

    imagesReady: PM.debounce(() => {
      PM.stage.sync();
      PM.panel.render();
    }, 30),

    async toggle(force) {
      await ready;
      const site = PM.store.site;
      site.open = force ?? !site.open;
      if (site.open) {
        mount();
        startLoop();
      } else {
        PM.picker.cancel();
        Object.assign(PM.ui, { selected: null, variant: null, group: null, view: 'layers' });
      }
      app.changed();
    },

    close: () => app.toggle(false),

    toggleHidden() {
      PM.store.site.hidden = !PM.store.site.hidden;
      app.changed();
    },

    toggleCollapsed() {
      const u = PM.store.ui;
      const el = PM.panel.el;
      const before = el.getBoundingClientRect();
      u.collapsed = !u.collapsed;
      PM.panel.render();
      if (u.x != null && before.left + before.width / 2 > innerWidth / 2) {
        u.x = before.right - el.getBoundingClientRect().width;
        Object.assign(u, PM.panel.place());
      }
      PM.store.save();
    },

    setView(view) {
      Object.assign(PM.ui, { view, selected: null, variant: null, group: null });
      app.changed('view');
    },

    select(id) {
      const f = PM.model.find(id);
      const prevGroup = PM.ui.group;
      if (PM.ui.selected !== id) PM.ui.variant = null;
      PM.ui.selected = f ? id : null;
      if (f) PM.ui.group = f.parent ? f.parent.id : null;
      PM.stage.sync();
      if (PM.ui.group === prevGroup) PM.panel.selectionChanged();
      else PM.panel.render();
    },

    enterGroup(id) {
      Object.assign(PM.ui, { group: id, selected: null, variant: null });
      app.changed('view');
    },

    exitGroup() {
      Object.assign(PM.ui, { selected: PM.ui.group, variant: null, group: null });
      app.changed('view');
    },

    update(id, patch, kind = 'value') {
      const f = PM.model.find(id);
      if (!f) return;
      const v = f.node.type === 'image' ? PM.variants.target(f.node) : null;
      for (const [k, val] of Object.entries(patch)) {
        if (v && PM.VARIANT_KEYS.includes(k)) v[k] = val;
        else f.node[k] = val;
      }
      app.changed(kind);
    },

    move(items, from, to) {
      if (from === to || from < 0) return;
      const [node] = items.splice(from, 1);
      items.splice(to, 0, node);
      app.changed();
    },

    nudge(dx, dy) {
      const e = editing();
      if (!e) return;
      e.v.x = PM.r2(e.v.x + dx);
      e.v.y = PM.r2(e.v.y + dy);
      app.changed('value');
    },

    setMode(id, mode) {
      const e = editing(id);
      if (!e || e.parent || e.v.mode === mode) return;
      keepInPlace(e.v, null, () => (e.v.mode = mode));
      app.changed();
    },

    setAnchor(id, anchor) {
      const e = editing(id);
      if (!e) return;
      Object.assign(e.v, { anchor, x: 0, y: 0 });
      app.changed();
    },

    setBlend(id, blend) {
      const e = editing(id);
      if (!e) return;
      const v = e.v;
      const was = v.blend || 'normal';
      if (was === blend) return;
      if (was === 'normal') v.restoreOpacity = v.opacity;
      if (blend === 'difference') v.opacity = 1;
      else if (blend === 'invert') v.opacity = 0.5;
      else if (v.restoreOpacity != null) v.opacity = v.restoreOpacity;
      if (blend === 'normal') delete v.restoreOpacity;
      v.blend = blend;
      app.changed();
    },

    cycleBlend() {
      const e = editing();
      if (!e) return;
      const order = ['normal', 'difference', 'invert'];
      app.setBlend(e.node.id, order[(order.indexOf(e.v.blend || 'normal') + 1) % 3]);
    },

    async addFiles(files) {
      const images = files.filter((f) => f.type.startsWith('image/'));
      if (!images.length) return PM.panel.toast('That doesn’t look like an image.');
      const group = currentGroup();
      const bp = PM.bp.fallback();
      const vw = document.documentElement.clientWidth;
      let note = '';
      let last = null;
      let added = 0;

      for (const file of images) {
        const got = await ingest(file);
        if (!got) continue;
        const layer = PM.model.newImage({ name: baseName(file.name), bp: bp.id, min: bp.min, img: got.imgId, w: got.w, h: got.h });
        const v = layer.variants[0];
        if (got.w > vw * 1.85 && got.w < vw * 2.15) {
          v.scale = 0.5;
          note = 'Looks like a @2x export, so it’s shown at 50%.';
        }
        if (group) {
          group.children.unshift(layer);
        } else {
          const { w, h } = PM.geo.size(v);
          if (w < vw * 0.6) PM.geo.place(v, null, (vw - w) / 2, Math.max(24, (innerHeight - h) / 2));
          PM.model.layers.unshift(layer);
        }
        last = layer;
        added++;
      }
      if (!last) return;
      PM.store.site.hidden = false;
      PM.ui.selected = last.id;
      PM.ui.variant = null;
      app.changed();
      if (bp.min > innerWidth) note = `It shows from ${bp.min}px up (${bp.name}), so it’s hidden at this width.`;
      PM.panel.toast(note || (added > 1 ? `Added ${added} layers.` : `Added “${last.name}”.`));
    },

    async replaceImage(id, file, variantId) {
      const f = PM.model.find(id);
      if (!f || f.node.type !== 'image') return;
      if (!file.type.startsWith('image/')) return PM.panel.toast('That doesn’t look like an image.');
      const v = f.node.variants.find((x) => x.id === variantId) || PM.variants.target(f.node);
      const got = await ingest(file);
      if (!got) return;
      const old = v.img;
      Object.assign(v, { img: got.imgId, w: got.w, h: got.h });
      releaseImages([old]);
      app.changed();
      PM.panel.toast(`Swapped in ${file.name || 'the new image'} for ${PM.variants.name(v)}.`);
    },

    remove(id) {
      const f = PM.model.find(id);
      if (!f) return;
      f.list.splice(f.index, 1);
      if (PM.ui.selected === id) PM.ui.selected = null;
      if (PM.ui.group === id) PM.ui.group = null;
      const ids = PM.model.imageIds(f.node);
      const timer = setTimeout(() => releaseImages(ids), 6000);
      app.changed();
      PM.panel.toast(`Deleted “${f.node.name}”.`, {
        label: 'Undo',
        run() {
          clearTimeout(timer);
          f.list.splice(Math.min(f.index, f.list.length), 0, f.node);
          PM.ui.selected = f.node.id;
          PM.ui.group = f.parent ? f.parent.id : null;
          app.changed();
        },
      });
    },

    editVariant(variantId) {
      const f = PM.model.find(PM.ui.selected);
      if (!f) return;
      const active = PM.variants.active(f.node);
      PM.ui.variant = active?.id === variantId ? null : variantId;
      app.changed('view');
    },

    addVariant(id, bp, min) {
      const e = editing(id);
      if (!e) return;
      const width = bp ? bp.min : Math.max(0, Math.round(min));
      if (e.node.variants.some((v) => PM.variants.min(v) === width)) {
        return PM.panel.toast(`There’s already a variant at ${width}px.`);
      }
      const v = { ...structuredClone(e.v), id: PM.uid(), bp: bp ? bp.id : null, min: width };
      delete v.restoreOpacity;
      e.node.variants.push(v);
      PM.variants.sort(e.node);
      PM.ui.variant = v.id;
      app.changed();
      PM.panel.toast(`Added ${bp ? bp.name : width + 'px'}. It starts as a copy.`, {
        label: 'Choose image',
        run: () => PM.panel.chooseImage(e.node.id, v.id),
      });
    },

    removeVariant(id, variantId) {
      const f = PM.model.find(id);
      if (!f || f.node.type !== 'image' || f.node.variants.length < 2) return;
      const vs = f.node.variants;
      const i = vs.findIndex((v) => v.id === variantId);
      if (i < 0) return;
      const [gone] = vs.splice(i, 1);
      if (PM.ui.variant === variantId) PM.ui.variant = null;
      const timer = setTimeout(() => releaseImages([gone.img]), 6000);
      app.changed();
      PM.panel.toast(`Removed the ${PM.variants.name(gone)} variant.`, {
        label: 'Undo',
        run() {
          clearTimeout(timer);
          vs.splice(i, 0, gone);
          app.changed();
        },
      });
    },

    attach(id) {
      pick((el) => {
        const f = PM.model.find(id);
        if (!f) return;
        const layers = PM.model.layers;
        f.list.splice(f.index, 1);
        let group = PM.model.groupFor(el);
        if (!group) {
          group = PM.model.newGroup(el);
          PM.elements.set(group, el);
          const at = f.parent ? layers.indexOf(f.parent) : f.index;
          layers.splice(Math.max(0, at), 0, group);
        }
        for (const v of f.node.variants) Object.assign(v, { anchor: 'tl', x: 0, y: 0 });
        group.children.unshift(f.node);
        PM.ui.group = group.id;
        PM.ui.selected = f.node.id;
        app.changed();
        PM.panel.toast(`Attached to ${group.name}.`);
      });
    },

    repick(groupId) {
      pick((el) => {
        const g = PM.model.find(groupId)?.node;
        if (!g) return;
        g.selector = PM.selectorFor(el);
        if (g.autoName) g.name = PM.labelFor(el);
        PM.elements.set(g, el);
        app.changed();
        PM.panel.toast(`Now following ${g.name}.`);
      });
    },

    detach(id) {
      const f = PM.model.find(id);
      if (!f?.parent) return;
      const layers = PM.model.layers;
      for (const v of f.node.variants) {
        const r = PM.geo.rect(v, f.parent);
        v.mode = 'page';
        if (r) PM.geo.place(v, null, r.left, r.top);
      }
      f.list.splice(f.index, 1);
      layers.splice(layers.indexOf(f.parent), 0, f.node);
      PM.ui.group = null;
      PM.ui.selected = f.node.id;
      app.changed();
      PM.panel.toast('Detached. It scrolls with the page now.');
    },

    ungroup(groupId) {
      const f = PM.model.find(groupId);
      if (!f) return;
      const g = f.node;
      for (const l of g.children) {
        for (const v of l.variants) {
          const r = PM.geo.rect(v, g);
          v.mode = 'page';
          if (r) PM.geo.place(v, null, r.left, r.top);
        }
      }
      f.list.splice(f.index, 1, ...g.children);
      PM.ui.group = null;
      PM.ui.selected = null;
      app.changed();
      const n = g.children.length;
      PM.panel.toast(n === 1 ? 'Ungrouped 1 layer.' : `Ungrouped ${n} layers.`);
    },

    setBreakpoints(list) {
      PM.store.setBreakpoints(list);
      for (const { layer } of PM.model.images()) {
        for (const v of layer.variants) {
          const b = PM.bp.byId(v.bp);
          if (b) v.min = b.min;
        }
        PM.variants.sort(layer);
      }
      if (!PM.bp.byId(PM.store.settings.defaultBp)) PM.store.settings.defaultBp = PM.store.breakpoints[0].id;
      app.changed();
    },

    addBreakpoint() {
      const list = PM.bp.list();
      const last = list[list.length - 1];
      const min = last.min < 1280 ? Math.max(last.min + 256, 1280) : last.min + 256;
      app.setBreakpoints([...list, { id: PM.uid(), name: min >= 1440 ? 'Wide' : 'Laptop', min }]);
    },

    removeBreakpoint(id) {
      const before = PM.bp.list().slice();
      const gone = PM.bp.byId(id);
      app.setBreakpoints(before.filter((b) => b.id !== id));
      PM.panel.toast(`Removed ${gone.name}. Variants using it keep its width.`, { label: 'Undo', run: () => app.setBreakpoints(before) });
    },

    setDefaultBreakpoint(id) {
      PM.store.settings.defaultBp = id;
      app.changed();
    },

    async exportFile() {
      try {
        await PM.transfer.download();
        PM.panel.toast(`Saved ${PM.transfer.fileName()}.`);
      } catch (err) {
        PM.panel.toast(`Couldn’t export: ${err.message}`);
      }
    },

    async importFile(file) {
      try {
        await app.importData(await PM.transfer.readFile(file), file.name);
      } catch (err) {
        PM.panel.toast(err.message);
      }
    },

    async importData(data, label) {
      let previous;
      try {
        previous = await PM.transfer.apply(data);
      } catch (err) {
        PM.panel.toast(err.message);
        return;
      }
      Object.assign(PM.ui, { selected: null, variant: null, group: null, view: 'layers' });
      PM.store.site.hidden = false;
      app.changed();
      PM.panel.toast(`Loaded ${label || 'layers'}.`, {
        label: 'Undo',
        run() {
          PM.store.page = previous;
          app.changed();
        },
      });
    },

    async addDataUrl(name, dataUrl) {
      const blob = PM.toBlob(dataUrl);
      await app.addFiles([new File([blob], name, { type: blob.type })]);
    },

    openLibrary() {
      chrome.runtime
        .sendMessage({ type: 'pm:open-library' })
        .then((res) => {
          if (!res?.ok) throw new Error();
        })
        .catch(() => PM.panel.toast('Open it from the extension’s menu: right-click the icon → Open side panel.'));
    },
  });

  function onResize() {
    lastWidth = innerWidth;
    if (!mounted || !PM.store.site.open) return;
    const key = PM.variants.key();
    if (key !== lastKey) app.changed('view');
    else if (PM.ui.selected) PM.panel.render();
  }

  function onKey(e) {
    if (!PM.alive()) return teardown();
    if (!PM.store.site.open || PM.picker.active || e.ctrlKey || e.metaKey) return;
    if (document.activeElement !== PM.host) return;
    const inner = PM.root.activeElement;
    if (PM.isEditable(inner)) return;

    const f = PM.model.find(PM.ui.selected);
    const step = e.shiftKey ? 10 : 1;
    const onButton = inner?.tagName === 'BUTTON';
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        if (f?.node.type !== 'image') {
          handled = false;
          break;
        }
        app.nudge(
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
        );
        break;
      case 'Delete':
      case 'Backspace':
        if (f) app.remove(f.node.id);
        else handled = false;
        break;
      case 'Escape':
        if (PM.panel.menuOpen) PM.panel.closeMenu();
        else if (PM.ui.view !== 'layers') app.setView('layers');
        else if (PM.ui.group) app.exitGroup();
        else if (f) app.select(null);
        else handled = false;
        break;
      case 'Enter':
        if (!onButton && f?.node.type === 'group') app.enterGroup(f.node.id);
        else handled = false;
        break;
      case 'h':
      case 'H':
        if (e.altKey) handled = false;
        else app.toggleHidden();
        break;
      case 'd':
      case 'D':
        if (e.altKey || f?.node.type !== 'image') handled = false;
        else app.cycleBlend();
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function onPaste(e) {
    if (!PM.alive()) return teardown();
    if (!PM.store.site.open) return;
    const typing = e.target === PM.host ? PM.isEditable(PM.root.activeElement) : PM.isEditable(e.target);
    if (typing) return;
    const files = [...(e.clipboardData?.files || [])].filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;
    e.preventDefault();
    e.stopPropagation();
    app.addFiles(files);
  }

  addEventListener('keydown', onKey, true);
  addEventListener('paste', onPaste, true);
  addEventListener('resize', onResize);
  addEventListener('pagehide', () => PM.alive() && PM.store.flush());

  const routeTimer = setInterval(async () => {
    if (!PM.alive()) return teardown();
    if (routing || location.pathname === PM.store.path) return;
    routing = true;
    try {
      PM.picker.cancel();
      Object.assign(PM.ui, { selected: null, variant: null, group: null });
      await PM.store.switchPath(location.pathname);
      if (mounted) app.changed('view');
    } finally {
      routing = false;
    }
  }, 700);

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let dirty = false;
    const bps = changes[PM.store.BP_KEY]?.newValue;
    if (bps && JSON.stringify(bps) !== JSON.stringify(PM.store.breakpoints)) {
      PM.store.setBreakpoints(bps);
      dirty = true;
    }
    const settings = changes[PM.store.SETTINGS_KEY]?.newValue;
    if (settings && JSON.stringify(settings) !== JSON.stringify(PM.store.settings)) {
      Object.assign(PM.store.settings, settings);
      dirty = true;
    }
    if (dirty && mounted) app.changed('view');
  });

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    switch (msg?.type) {
      case 'pm:toggle':
        app.toggle();
        reply({ ok: true });
        return;
      case 'pm:add-image':
        ensureOpen()
          .then(() => app.addDataUrl(msg.name, msg.dataUrl))
          .then(() => reply({ ok: true }), (err) => reply({ ok: false, error: err.message }));
        return true;
      case 'pm:import':
        ensureOpen()
          .then(() => app.importData(msg.data, msg.name))
          .then(() => reply({ ok: true }), (err) => reply({ ok: false, error: err.message }));
        return true;
      case 'pm:snapshot':
        ready
          .then(() => PM.transfer.snapshot())
          .then((data) => reply({ ok: true, data, name: PM.transfer.fileName() }), (err) => reply({ ok: false, error: err.message }));
        return true;
    }
  });

  ready.then(() => {
    if (!PM.store.site.open) return;
    mount();
    startLoop();
    app.changed('view');
  });
})();
