(() => {
  const PM = (globalThis.__pm = globalThis.__pm || {});

  PM.uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  PM.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  PM.r2 = (v) => Math.round(v * 100) / 100;

  PM.alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };

  PM.debounce = (fn, ms) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  PM.isEditable = (el) =>
    !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

  PM.h = (tag, props, ...kids) => {
    const el = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style') el.style.cssText = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'value') el.value = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid != null && kid !== false) el.append(kid);
    }
    return el;
  };

  const NS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs) => {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) if (attrs[k] != null) el.setAttribute(k, attrs[k]);
    return el;
  };
  const p = (d) => ['path', { d }];
  const ICONS = {
    eye: [p('M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z'), ['circle', { cx: 8, cy: 8, r: 2 }]],
    eyeOff: [
      p('M2.5 2.5l11 11'),
      p('M6.6 3.65A6.7 6.7 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a12 12 0 0 1-1.75 2.35'),
      p('M10.4 11.95A6.4 6.4 0 0 1 8 12.5C3.9 12.5 1.5 8 1.5 8a12 12 0 0 1 2.55-3.05'),
      p('M6.6 6.6a2 2 0 0 0 2.8 2.8'),
    ],
    lock: [['rect', { x: 3.5, y: 7, width: 9, height: 6.5, rx: 1.5 }], p('M5.5 7V5a2.5 2.5 0 0 1 5 0v2')],
    unlock: [['rect', { x: 3.5, y: 7, width: 9, height: 6.5, rx: 1.5 }], p('M5.5 7V5a2.5 2.5 0 0 1 4.85-.85')],
    plus: [p('M8 3v10M3 8h10')],
    minus: [p('M3.5 8h9')],
    expand: [p('M9.5 3H13v3.5M6.5 13H3V9.5M13 3 9 7M3 13l4-4')],
    close: [p('M4 4l8 8M12 4l-8 8')],
    back: [p('M9.5 3.5 5 8l4.5 4.5')],
    chevron: [p('M6.5 3.5 11 8l-4.5 4.5')],
    target: [['circle', { cx: 8, cy: 8, r: 5 }], ['circle', { cx: 8, cy: 8, r: 1.4 }], p('M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15')],
    unlink: [
      p('M7 4.6l1.3-1.3a2.6 2.6 0 0 1 3.7 3.7l-1.3 1.3'),
      p('M9 11.4l-1.3 1.3a2.6 2.6 0 0 1-3.7-3.7l1.3-1.3'),
      p('M2.5 2.5l2 2M13.5 13.5l-2-2'),
    ],
    trash: [p('M2.5 4.5h11'), p('M6 4.5V3h4v1.5'), p('M4 4.5l.7 8.6a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9l.7-8.6')],
    page: [['rect', { x: 3, y: 1.5, width: 10, height: 13, rx: 1.5 }], p('M5.5 5h5M5.5 7.5h5M5.5 10h3')],
    screen: [['rect', { x: 1.5, y: 2.5, width: 13, height: 9, rx: 1.5 }], p('M5.5 14h5M8 11.5V14')],
    difference: [['circle', { cx: 6, cy: 8, r: 4 }], ['circle', { cx: 10, cy: 8, r: 4 }]],
    stack: [p('M8 2 14 5 8 8 2 5Z'), p('M2 8.2l6 3 6-3'), p('M2 11.2l6 3 6-3')],
    warn: [p('M8 2.2 14.5 13.5h-13Z'), p('M8 6.5v3'), p('M8 11.6v.01')],
    more: [p('M3.5 8h.01M8 8h.01M12.5 8h.01')],
    reset: [p('M3 3.5v3h3'), p('M3.4 6.5A5 5 0 1 1 3.5 10')],
    replace: [p('M2.5 5.5h9l-2.5-2.5'), p('M13.5 10.5h-9l2.5 2.5')],
    download: [p('M8 2.5v8M4.75 7.25 8 10.5l3.25-3.25'), p('M2.75 12.5v.25c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1v-.25')],
    upload: [p('M8 10.5V2.5M4.75 5.75 8 2.5l3.25 3.25'), p('M2.75 12.5v.25c0 .55.45 1 1 1h8.5c.55 0 1-.45 1-1v-.25')],
    folder: [p('M1.75 4.25c0-.55.45-1 1-1h3.1l1.5 1.5h5.9c.55 0 1 .45 1 1v6.5c0 .55-.45 1-1 1H2.75c-.55 0-1-.45-1-1Z')],
    sliders: [p('M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6'), ['circle', { cx: 10, cy: 4.5, r: 1.5 }], ['circle', { cx: 6, cy: 11.5, r: 1.5 }]],
    devices: [['rect', { x: 1.5, y: 3, width: 9.5, height: 7, rx: 1.2 }], p('M4 12.5h4.5'), ['rect', { x: 10.5, y: 6, width: 4, height: 7.5, rx: 1 }]],
  };

  PM.icon = (name, size = 16) => {
    const el = svg('svg', {
      viewBox: '0 0 16 16',
      width: size,
      height: size,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      'aria-hidden': 'true',
    });
    for (const [tag, attrs] of ICONS[name] || []) el.append(svg(tag, attrs));
    return el;
  };

  PM.mark = (size = 18, tilt = false) => {
    const el = svg('svg', { viewBox: '0 0 18 18', width: size, height: size, class: 'mark', 'aria-hidden': 'true' });
    el.append(
      svg('rect', { x: 1.75, y: 1.75, width: 10.5, height: 10.5, rx: 2.25, class: 'mark-back' }),
      svg('rect', {
        x: 5.75,
        y: 5.75,
        width: 10.5,
        height: 10.5,
        rx: 2.25,
        class: 'mark-front',
        transform: tilt ? 'rotate(-7 11 11)' : null,
      }),
    );
    return el;
  };
})();
