(() => {
  const PM = globalThis.__pm;
  if (PM.picker) return;
  const { h } = PM;
  let active = null;

  function start({ onPick, onCancel }) {
    active?.finish();

    const box = h('div', { class: 'pick-box', hidden: true });
    const tag = h('div', { class: 'pick-tag', hidden: true });
    PM.wrap.append(box, tag);
    const cursor = document.createElement('style');
    cursor.textContent = '*, *::before, *::after { cursor: crosshair !important; }';
    document.documentElement.append(cursor);

    let target = null;
    let trail = [];

    const ours = (e) => e.target === PM.host;
    const fromPoint = (x, y) =>
      document.elementsFromPoint(x, y).find((el) => el !== PM.host && el !== document.documentElement && el !== cursor) ||
      null;

    function show(el) {
      target = el;
      if (!el) {
        box.hidden = tag.hidden = true;
        return;
      }
      const r = el.getBoundingClientRect();
      box.hidden = tag.hidden = false;
      box.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
      tag.replaceChildren(PM.labelFor(el), h('span', null, `${Math.round(r.width)} × ${Math.round(r.height)}`));
      const tw = tag.offsetWidth;
      const vw = document.documentElement.clientWidth;
      const top = r.top > 30 ? r.top - 26 : Math.min(r.bottom + 6, innerHeight - 28);
      tag.style.left = PM.clamp(r.left, 6, Math.max(6, vw - tw - 6)) + 'px';
      tag.style.top = Math.max(6, top) + 'px';
    }

    const block = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const onMove = (e) => {
      if (ours(e)) return;
      trail = [];
      show(fromPoint(e.clientX, e.clientY));
    };
    const onPress = (e) => {
      if (!ours(e)) block(e);
    };
    const onClick = (e) => {
      if (ours(e)) return;
      block(e);
      const el = target || fromPoint(e.clientX, e.clientY);
      finish();
      if (el) onPick(el);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        block(e);
        finish();
        onCancel?.();
      } else if (e.key === 'ArrowUp' && target?.parentElement && target.parentElement !== document.documentElement) {
        block(e);
        trail.push(target);
        show(target.parentElement);
      } else if (e.key === 'ArrowDown' && trail.length) {
        block(e);
        show(trail.pop());
      } else if (e.key === 'Enter' && target) {
        block(e);
        const el = target;
        finish();
        onPick(el);
      }
    };
    const onScroll = () => target && show(target);

    const opts = { capture: true };
    const listeners = [
      ['pointermove', onMove],
      ['pointerdown', onPress],
      ['mousedown', onPress],
      ['pointerup', onPress],
      ['mouseup', onPress],
      ['click', onClick],
      ['keydown', onKey],
      ['scroll', onScroll],
    ];
    for (const [type, fn] of listeners) addEventListener(type, fn, opts);

    function finish() {
      for (const [type, fn] of listeners) removeEventListener(type, fn, opts);
      box.remove();
      tag.remove();
      cursor.remove();
      active = null;
    }

    active = {
      finish,
      cancel() {
        finish();
        onCancel?.();
      },
    };
  }

  PM.picker = {
    start,
    cancel: () => active?.cancel(),
    get active() {
      return !!active;
    },
  };
})();
