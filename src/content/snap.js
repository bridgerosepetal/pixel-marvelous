(() => {
  const PM = globalThis.__pm;
  if (PM.snap) return;
  const THRESHOLD = 6;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'TITLE', 'NOSCRIPT', 'BR', 'TEMPLATE', 'WBR']);

  let xs = [];
  let ys = [];

  function add(r, quiet = false) {
    const box = { left: r.left, top: r.top, right: r.left + r.width, bottom: r.top + r.height, quiet };
    xs.push({ v: box.left, box }, { v: r.left + r.width / 2, box }, { v: box.right, box });
    ys.push({ v: box.top, box }, { v: r.top + r.height / 2, box }, { v: box.bottom, box });
  }

  function begin(excludeId) {
    xs = [];
    ys = [];
    const vw = document.documentElement.clientWidth;
    const vh = innerHeight;
    const margin = 400;

    add({ left: 0, top: 0, width: vw, height: vh }, true);
    const o = PM.stage.origin();
    add({ left: o.left, top: o.top, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, true);

    const all = document.body ? document.body.getElementsByTagName('*') : [];
    const t0 = performance.now();
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (SKIP.has(el.tagName)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) continue;
      if (r.right < -margin || r.left > vw + margin || r.bottom < -margin || r.top > vh + margin) continue;
      add(r);
      if ((i & 255) === 0 && performance.now() - t0 > 50) break;
    }

    for (const { layer, group } of PM.model.images()) {
      if (layer.id === excludeId || !layer.visible || (group && !group.visible)) continue;
      const v = PM.variants.shown(layer);
      const r = v && PM.geo.rect(v, group);
      if (r) add(r);
    }
  }

  function nearest(lines, start, size) {
    const points = [start, start + size / 2, start + size];
    let best = null;
    let bestDist = THRESHOLD;
    for (const line of lines) {
      for (let k = 0; k < 3; k++) {
        const d = line.v - points[k];
        const ad = Math.abs(d);
        if (ad < bestDist) {
          bestDist = ad;
          best = { d, line };
        }
      }
    }
    return best;
  }

  function draw(bx, by, r) {
    const g = PM.stage.snapLayer;
    g.replaceChildren();
    const L = r.left, T = r.top, R = r.left + r.width, B = r.top + r.height;
    const boxes = new Set();
    if (bx) {
      const b = bx.line.box;
      const top = Math.min(T, b.top), bottom = Math.max(B, b.bottom);
      g.append(PM.h('div', { class: 'guide x', style: `left:${bx.line.v}px;top:${top}px;height:${bottom - top}px` }));
      if (!b.quiet) boxes.add(b);
    }
    if (by) {
      const b = by.line.box;
      const left = Math.min(L, b.left), right = Math.max(R, b.right);
      g.append(PM.h('div', { class: 'guide y', style: `top:${by.line.v}px;left:${left}px;width:${right - left}px` }));
      if (!b.quiet) boxes.add(b);
    }
    for (const b of boxes) {
      g.append(PM.h('div', { class: 'target', style: `left:${b.left}px;top:${b.top}px;width:${b.right - b.left}px;height:${b.bottom - b.top}px` }));
    }
  }

  function apply(r, off) {
    if (off) {
      PM.stage.snapLayer.replaceChildren();
      return { dx: 0, dy: 0 };
    }
    const bx = nearest(xs, r.left, r.width);
    const by = nearest(ys, r.top, r.height);
    const dx = bx ? bx.d : 0;
    const dy = by ? by.d : 0;
    draw(bx, by, { ...r, left: r.left + dx, top: r.top + dy });
    return { dx, dy };
  }

  function end() {
    xs = [];
    ys = [];
    PM.stage.snapLayer.replaceChildren();
  }

  PM.snap = { begin, apply, end };
})();
