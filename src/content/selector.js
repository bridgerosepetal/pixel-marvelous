(() => {
  const PM = globalThis.__pm;
  if (PM.selectorFor) return;

  const generated = (s) => s.length > 40 || /\d{4,}|^:r|[0-9a-f]{8,}/i.test(s);

  const goodClasses = (el) =>
    [...el.classList].filter(
      (c) =>
        c.length < 32 &&
        !/[:\[\]\/@!.#]/.test(c) &&
        !/^(css|sc|jsx|svelte|emotion|chakra|ng)-/.test(c) &&
        !/[0-9a-f]{6,}|__[a-z0-9]{5}$/i.test(c) &&
        !/^(is|has)-|^(active|open|hover|focus|selected|visible|hidden|show)$/.test(c),
    );

  PM.labelFor = (el) => {
    const tag = el.tagName.toLowerCase();
    if (el.id && !generated(el.id)) return '#' + el.id;
    const cls = goodClasses(el)[0];
    return cls ? `${tag}.${cls}` : tag;
  };

  PM.selectorFor = (el) => {
    const esc = CSS.escape;
    const unique = (sel) => {
      try {
        const all = document.querySelectorAll(sel);
        return all.length === 1 && all[0] === el;
      } catch {
        return false;
      }
    };
    const count = (sel) => {
      try {
        return document.querySelectorAll(sel).length;
      } catch {
        return 0;
      }
    };

    if (el.id && !generated(el.id) && unique('#' + esc(el.id))) return '#' + esc(el.id);

    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      if (cur !== el && cur.id && !generated(cur.id) && count('#' + esc(cur.id)) === 1) {
        parts.unshift('#' + esc(cur.id));
        break;
      }
      if (cur === document.body) {
        parts.unshift('body');
        break;
      }
      let part = cur.tagName.toLowerCase() + goodClasses(cur).slice(0, 2).map((c) => '.' + esc(c)).join('');
      const parent = cur.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      const sel = parts.join(' > ');
      if (unique(sel)) return sel;
      cur = parent;
    }
    return parts.join(' > ');
  };
})();
