(() => {
  const PM = globalThis.__pm;
  if (PM.model) return;

  PM.VARIANT_KEYS = ['img', 'w', 'h', 'x', 'y', 'scale', 'opacity', 'blend', 'mode', 'anchor', 'restoreOpacity'];

  const M = (PM.model = {
    get layers() {
      return PM.store.page.layers;
    },

    find(id, list = M.layers, parent = null) {
      if (!id) return null;
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        if (node.id === id) return { node, list, index: i, parent };
        if (node.type === 'group') {
          const hit = M.find(id, node.children, node);
          if (hit) return hit;
        }
      }
      return null;
    },

    images() {
      const out = [];
      for (const node of M.layers) {
        if (node.type === 'group') for (const layer of node.children) out.push({ layer, group: node });
        else out.push({ layer: node, group: null });
      }
      return out;
    },

    newVariant: (props) => ({
      id: PM.uid(),
      bp: null,
      min: 0,
      img: null,
      w: 0,
      h: 0,
      x: 0,
      y: 0,
      scale: 1,
      opacity: 0.5,
      blend: 'normal',
      mode: 'page',
      anchor: 'tl',
      ...props,
    }),

    newImage: ({ name = 'Layer', ...variant } = {}) => ({
      id: PM.uid(),
      type: 'image',
      name,
      visible: true,
      locked: false,
      variants: [M.newVariant(variant)],
    }),

    newGroup: (el) => ({
      id: PM.uid(),
      type: 'group',
      name: PM.labelFor(el),
      autoName: true,
      selector: PM.selectorFor(el),
      visible: true,
      children: [],
    }),

    groupFor: (el) => M.layers.find((n) => n.type === 'group' && PM.elements.resolve(n) === el) || null,

    imageIds: (node) =>
      (node.type === 'group' ? node.children : [node]).flatMap((l) => l.variants.map((v) => v.img)),

    usedImages: () => new Set(M.layers.flatMap(M.imageIds)),
  });

  PM.bp = {
    list: () => PM.store.breakpoints,
    byId: (id) => PM.store.breakpoints.find((b) => b.id === id) || null,
    byMin: (min) => PM.store.breakpoints.find((b) => b.min === min) || null,
    fallback: () => PM.bp.byId(PM.store.settings.defaultBp) || PM.store.breakpoints[0],
  };

  const V = (PM.variants = {
    min: (v) => PM.bp.byId(v.bp)?.min ?? v.min ?? 0,

    name: (v) => PM.bp.byId(v.bp)?.name || 'Custom',

    sort(layer) {
      layer.variants.sort((a, b) => V.min(a) - V.min(b));
    },

    active(layer, width = innerWidth) {
      let hit = null;
      for (const v of layer.variants) if (V.min(v) <= width && (!hit || V.min(v) >= V.min(hit))) hit = v;
      return hit;
    },

    target(layer) {
      if (PM.ui.selected === layer.id && PM.ui.variant) {
        const picked = layer.variants.find((v) => v.id === PM.ui.variant);
        if (picked) return picked;
      }
      return V.active(layer) || layer.variants[0];
    },

    shown(layer) {
      return PM.ui.selected === layer.id ? V.target(layer) : V.active(layer);
    },

    range(layer, v) {
      const min = V.min(v);
      const next = layer.variants.map(V.min).filter((m) => m > min);
      return [min, next.length ? Math.min(...next) - 1 : Infinity];
    },

    key(width = innerWidth) {
      return M.images()
        .map(({ layer }) => V.active(layer, width)?.id || '-')
        .join();
    },
  });

  const cache = new Map();
  PM.elements = {
    resolve(group) {
      const hit = cache.get(group.id);
      if (hit && hit.sel === group.selector) {
        if (hit.el?.isConnected) return hit.el;
        if (!hit.el && performance.now() - hit.t < 500) return null;
      }
      let el = null;
      try {
        el = document.querySelector(group.selector);
      } catch {}
      cache.set(group.id, { el, sel: group.selector, t: performance.now() });
      return el;
    },
    set(group, el) {
      cache.set(group.id, { el, sel: group.selector, t: performance.now() });
    },
    rect(group) {
      const el = PM.elements.resolve(group);
      if (!el || !el.getClientRects().length) return null;
      return el.getBoundingClientRect();
    },
  };

  PM.ANCHORS = {
    tl: [0, 0], tc: [0.5, 0], tr: [1, 0],
    ml: [0, 0.5], mc: [0.5, 0.5], mr: [1, 0.5],
    bl: [0, 1], bc: [0.5, 1], br: [1, 1],
  };

  PM.geo = {
    size: (v) => ({ w: v.w * v.scale, h: v.h * v.scale }),

    rect(v, group) {
      const { w, h } = PM.geo.size(v);
      let left, top;
      if (group) {
        const e = PM.elements.rect(group);
        if (!e) return null;
        const [ax, ay] = PM.ANCHORS[v.anchor] || PM.ANCHORS.tl;
        left = e.left + ax * (e.width - w) + v.x;
        top = e.top + ay * (e.height - h) + v.y;
      } else if (v.mode === 'screen') {
        left = v.x;
        top = v.y;
      } else {
        const o = PM.stage.origin();
        left = o.left + v.x;
        top = o.top + v.y;
      }
      return { left, top, width: w, height: h, right: left + w, bottom: top + h };
    },

    place(v, group, left, top) {
      const { w, h } = PM.geo.size(v);
      if (group) {
        const e = PM.elements.rect(group);
        if (!e) return;
        const [ax, ay] = PM.ANCHORS[v.anchor] || PM.ANCHORS.tl;
        v.x = PM.r2(left - e.left - ax * (e.width - w));
        v.y = PM.r2(top - e.top - ay * (e.height - h));
      } else if (v.mode === 'screen') {
        v.x = PM.r2(left);
        v.y = PM.r2(top);
      } else {
        const o = PM.stage.origin();
        v.x = PM.r2(left - o.left);
        v.y = PM.r2(top - o.top);
      }
    },
  };
})();
