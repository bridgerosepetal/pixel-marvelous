(() => {
  const PM = globalThis.__pm;
  if (PM.stage) return;
  const { h } = PM;
  const Z = 2147482000;

  const S = (PM.stage = {
    els: new Map(),

    mount(wrap) {
      S.doc = h('div', { class: 'doc' });
      S.fixed = h('div', { class: 'fixed-stage' });
      S.snapLayer = h('div');
      S.frameTag = h('span', { class: 'frame-tag' });
      S.frameBox = h('div', { class: 'frame', hidden: true }, S.frameTag);
      wrap.append(S.doc, S.fixed, h('div', { class: 'guides' }, S.frameBox, S.snapLayer));
    },

    origin() {
      const r = S.doc.getBoundingClientRect();
      return { left: r.left, top: r.top };
    },

    sync() {
      if (!S.doc) return;
      const list = PM.model.images();
      const seen = new Set();
      list.forEach(({ layer, group }, i) => {
        seen.add(layer.id);
        let el = S.els.get(layer.id);
        if (!el) {
          el = h('img', { class: 'ov', alt: '', draggable: 'false', tabindex: '-1' });
          el.dataset.id = layer.id;
          el.addEventListener('pointerdown', onPointerDown);
          S.els.set(layer.id, el);
        }
        const v = PM.variants.shown(layer);
        if (!v) {
          el.hidden = true;
          return;
        }
        const url = PM.imageUrl(v.img);
        if (url === undefined) PM.ensureImage(v.img);
        else if (url && el.getAttribute('src') !== url) el.src = url;

        const screen = !group && v.mode === 'screen';
        const parent = screen ? S.fixed : S.doc;
        if (el.parentNode !== parent) {
          parent.append(el);
          el._t = null;
        }
        const { w, h: ht } = PM.geo.size(v);
        el.classList.toggle('screen', screen);
        el.classList.toggle('locked', !!layer.locked);
        el.classList.toggle('sel', PM.ui.selected === layer.id);
        el.style.width = w + 'px';
        el.style.height = ht + 'px';
        el.style.opacity = v.opacity;
        el.style.mixBlendMode = v.blend === 'difference' ? 'difference' : 'normal';
        el.style.filter = v.blend === 'invert' ? 'invert(1)' : 'none';
        el.style.zIndex = Z + list.length - i;
        el.hidden = !url || !layer.visible || (group && !group.visible);
      });
      for (const [id, el] of S.els) {
        if (!seen.has(id)) {
          el.remove();
          S.els.delete(id);
        }
      }
      const on = PM.store.site.open && !PM.store.site.hidden;
      S.doc.hidden = S.fixed.hidden = !on;
      S.frame();
    },

    frame() {
      if (!S.doc) return;
      if (!S.doc.hidden) {
        let o = null;
        for (const { layer, group } of PM.model.images()) {
          const el = S.els.get(layer.id);
          if (!el || el.hidden) continue;
          const v = PM.variants.shown(layer);
          if (!v) continue;
          let x = v.x;
          let y = v.y;
          if (group) {
            const r = PM.geo.rect(v, group);
            const vis = r ? '' : 'hidden';
            if (el.style.visibility !== vis) el.style.visibility = vis;
            if (!r) continue;
            o = o || S.origin();
            x = r.left - o.left;
            y = r.top - o.top;
          }
          const t = `translate(${x}px,${y}px)`;
          if (el._t !== t) {
            el.style.transform = t;
            el._t = t;
          }
        }
      }
      S.drawFrame();
    },

    drawFrame() {
      const ui = PM.ui;
      let g = ui.group ? PM.model.find(ui.group)?.node : null;
      if (!g) {
        const f = PM.model.find(ui.selected);
        if (f?.node.type === 'group') g = f.node;
      }
      const r = g && PM.store.site.open && !ui.picking ? PM.elements.rect(g) : null;
      if (!r) {
        S.frameBox.hidden = true;
        return;
      }
      S.frameBox.hidden = false;
      const css = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      if (S.frameCss !== css) S.frameBox.style.cssText = S.frameCss = css;
      if (S.frameTag.textContent !== g.name) S.frameTag.textContent = g.name;
    },
  });

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const f = PM.model.find(el.dataset.id);
    if (!f) return;
    e.preventDefault();
    e.stopPropagation();
    el.focus({ preventScroll: true });
    PM.app.select(f.node.id);

    const layer = f.node;
    const group = f.parent;
    const v = PM.variants.shown(layer);
    const start = v && PM.geo.rect(v, group);
    if (!start) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    el.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (!moved) {
        if (Math.hypot(dx, dy) < 3) return;
        moved = true;
        el.classList.add('dragging');
        PM.snap.begin(layer.id);
      }
      const r = { left: start.left + dx, top: start.top + dy, width: start.width, height: start.height };
      const s = PM.snap.apply(r, ev.altKey);
      PM.geo.place(v, group, r.left + s.dx, r.top + s.dy);
      S.frame();
      PM.panel.refresh();
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging');
      if (moved) {
        PM.snap.end();
        PM.app.changed('value');
      }
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }
})();
