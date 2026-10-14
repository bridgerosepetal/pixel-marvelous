(() => {
  const PM = globalThis.__pm;
  if (PM.panel) return;
  const { h, icon } = PM;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);

  let el, body, crumbs, list, props, foot, toastEl, menuEl;
  let fileInput, replaceInput, importInput, titleCount, hideBtn, collapseBtn, menuBtn;
  let toastTimer = 0;
  let replaceTarget = null;
  let addingVariant = false;

  const stop = (e) => e.stopPropagation();

  const ib = (name, title, onclick, cls = '') =>
    h(
      'button',
      {
        class: 'ib ' + cls,
        title,
        'aria-label': title,
        onpointerdown: stop,
        onclick: (e) => {
          e.stopPropagation();
          onclick(e);
        },
      },
      icon(name),
    );

  const btn = (name, label, onclick, title, cls = '') =>
    h(
      'button',
      { class: 'btn ' + cls + (label ? '' : ' icon'), title, 'aria-label': title || label, onclick },
      name ? icon(name, 14) : null,
      label || null,
    );

  const kbd = (k) => h('kbd', null, k);
  const lab = (text) => h('span', { class: 'lab' }, text);

  function setIcon(button, name, title) {
    button.replaceChildren(icon(name));
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  const fileField = (accept, multiple, onFiles) => {
    const input = h('input', { type: 'file', accept, multiple, hidden: true });
    input.addEventListener('change', () => {
      const files = [...input.files];
      input.value = '';
      if (files.length) onFiles(files);
    });
    return input;
  };

  function mount(wrap) {
    fileInput = fileField('image/*', true, (files) => PM.app.addFiles(files));
    replaceInput = fileField('image/*', false, ([file]) => replaceTarget && PM.app.replaceImage(replaceTarget.layer, file, replaceTarget.variant));
    importInput = fileField('.json,application/json', false, ([file]) => PM.app.importFile(file));

    hideBtn = ib('eye', '', () => PM.app.toggleHidden());
    menuBtn = ib('more', 'More', () => toggleMenu());
    collapseBtn = ib('minus', '', () => PM.app.toggleCollapsed());
    const bar = h(
      'div',
      { class: 'bar', onpointerdown: dragPanel, ondblclick: () => PM.app.toggleCollapsed() },
      PM.mark(18),
      h('div', { class: 'title' }, 'pixel marvelous', (titleCount = h('span', { class: 'title-count' }))),
      hideBtn,
      menuBtn,
      collapseBtn,
      ib('close', 'Turn off on this site', () => PM.app.close()),
    );
    menuEl = h('div', { class: 'menu', role: 'menu', hidden: true });
    crumbs = h('div', { class: 'crumbs' });
    list = h('div', { class: 'list' });
    props = h('div', { class: 'props', hidden: true });
    foot = h('div', { class: 'foot' });
    toastEl = h('div', { class: 'toast', role: 'status' });
    body = h('div', { class: 'body' }, crumbs, list, props, foot);
    el = h('div', { class: 'panel', tabindex: '-1', hidden: true }, bar, body, menuEl, toastEl, fileInput, replaceInput, importInput);

    for (const type of ['keydown', 'keyup', 'keypress']) el.addEventListener(type, stop);
    el.addEventListener('pointerdown', (e) => {
      if (!menuEl.hidden && !menuEl.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
    });

    el.addEventListener('dragenter', onDragOver);
    el.addEventListener('dragover', onDragOver);
    el.addEventListener('dragleave', (e) => {
      if (!el.contains(e.relatedTarget)) el.classList.remove('drop');
    });
    el.addEventListener('drop', onDrop);
    wrap.append(el);
    addEventListener('resize', place);
  }

  function onDragOver(e) {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop');
  }

  function onDrop(e) {
    el.classList.remove('drop');
    const files = [...(e.dataTransfer?.files || [])];
    if (!files.length) return;
    e.preventDefault();
    const json = files.find((f) => f.name.endsWith('.json') || f.type === 'application/json');
    if (json) PM.app.importFile(json);
    else PM.app.addFiles(files);
  }

  function toggleMenu() {
    if (!menuEl.hidden) return closeMenu();
    const item = (name, label, run, hint) =>
      h(
        'button',
        { class: 'menu-item', role: 'menuitem', onclick: () => { closeMenu(); run(); } },
        icon(name, 14),
        h('span', null, label),
        hint ? h('span', { class: 'menu-hint' }, hint) : null,
      );
    menuEl.replaceChildren(
      item('folder', 'Collections', () => PM.app.openLibrary(), 'side panel'),
      item('sliders', 'Settings', () => PM.app.setView('settings')),
      h('div', { class: 'menu-sep' }),
      item('download', 'Export to file', () => PM.app.exportFile()),
      item('upload', 'Import from file', () => importInput.click()),
    );
    menuEl.hidden = false;
    menuBtn.classList.add('on');
  }

  function closeMenu() {
    menuEl.hidden = true;
    menuBtn.classList.remove('on');
  }

  function place() {
    if (!el || el.hidden) return;
    const u = PM.store.ui;
    const vw = document.documentElement.clientWidth;
    const w = el.offsetWidth;
    const x = PM.clamp(u.x == null ? vw - w - 16 : u.x, 8, Math.max(8, vw - w - 8));
    const y = PM.clamp(u.y ?? 16, 8, Math.max(8, innerHeight - 50));
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    return { x, y };
  }

  function dragPanel(e) {
    if (e.button !== 0) return;
    const bar = e.currentTarget;
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left;
    const oy = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    el.classList.add('moving');
    const move = (ev) => {
      PM.store.ui.x = ev.clientX - ox;
      PM.store.ui.y = ev.clientY - oy;
      Object.assign(PM.store.ui, place());
    };
    const up = () => {
      bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
      el.classList.remove('moving');
      PM.store.save();
    };
    bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  }

  function render() {
    if (!el) return;
    const site = PM.store.site;
    el.hidden = !site.open;
    if (!site.open) return closeMenu();
    const collapsed = !!PM.store.ui.collapsed;
    el.classList.toggle('collapsed', collapsed);
    if (collapsed) closeMenu();
    setIcon(hideBtn, site.hidden ? 'eyeOff' : 'eye', site.hidden ? 'Show overlays (H)' : 'Hide overlays (H)');
    hideBtn.classList.toggle('on', site.hidden);
    setIcon(collapseBtn, collapsed ? 'expand' : 'minus', collapsed ? 'Expand' : 'Minimize');
    const total = PM.model.images().length;
    titleCount.textContent = total ? String(total) : '';

    list.classList.toggle('tall', PM.ui.view === 'settings');
    if (PM.ui.view === 'settings') {
      renderSettings();
    } else {
      const group = PM.ui.group ? PM.model.find(PM.ui.group)?.node : null;
      if (PM.ui.group && !group) PM.ui.group = null;
      renderCrumbs(group);
      renderList(group);
      renderProps(group);
      renderFoot(group);
    }
    place();
  }

  function renderSettings() {
    props.hidden = true;
    crumbs.replaceChildren(
      h('button', { class: 'crumb-back', title: 'Back to layers (Esc)', onclick: () => PM.app.setView('layers') }, icon('back', 14), 'Layers'),
      h('span', { class: 'crumb-sep' }, '/'),
      h('span', { class: 'crumb-here' }, icon('sliders', 14), h('span', null, 'Settings')),
    );

    const bps = PM.bp.list();
    const commit = () => {
      const next = [...list.querySelectorAll('.bprow')].map((row) => ({
        id: row.dataset.id,
        name: row.querySelector('.bp-name-in').value.trim() || 'Device',
        min: parseInt(row.querySelector('.bp-min-in').value, 10) || 0,
      }));
      PM.app.setBreakpoints(next);
    };
    const rows = bps.map((b, i) => {
      const name = h('input', { class: 'text bp-name-in', spellcheck: 'false', 'aria-label': 'Name', value: b.name });
      const min = h('input', {
        class: 'num bp-min-in',
        inputmode: 'numeric',
        'aria-label': 'Minimum width',
        disabled: i === 0,
        title: i === 0 ? 'The smallest breakpoint starts at 0' : 'Applies from this width up',
        value: String(b.min),
      });
      for (const input of [name, min]) {
        input.addEventListener('change', commit);
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
      }
      return h(
        'div',
        { class: 'bprow', dataset: { id: b.id } },
        name,
        h('div', { class: 'numf' }, min, h('span', { class: 'unit' }, 'px+')),
        i === 0 ? h('span', { class: 'ib-spacer' }) : ib('trash', `Remove ${b.name}`, () => PM.app.removeBreakpoint(b.id), 'danger keep'),
      );
    });

    const def = PM.bp.fallback();
    list.replaceChildren(
      h('div', { class: 'set-title' }, 'Breakpoints'),
      h('p', { class: 'hint set-intro' }, 'Image variants pick from these. Wider ones override narrower ones, like mobile-first media queries.'),
      ...rows,
      h(
        'div',
        { class: 'set-row' },
        btn('plus', 'Add device', () => PM.app.addBreakpoint(), 'Add a breakpoint'),
        h('span', { class: 'spacer' }),
        btn(null, 'Reset', () => PM.app.setBreakpoints(structuredClone(PM.DEFAULT_BREAKPOINTS)), 'Back to Mobile, Tablet, Desktop', 'ghost'),
      ),
      h('div', { class: 'set-title' }, 'New images start at'),
      h(
        'div',
        { class: 'seg wrap' },
        bps.map((b) =>
          h(
            'button',
            { class: b === def ? 'on' : '', title: `${b.name}: shows from ${b.min}px up`, onclick: () => PM.app.setDefaultBreakpoint(b.id) },
            b.name,
          ),
        ),
      ),
      h(
        'p',
        { class: 'hint set-intro' },
        def.min ? `New images show from ${def.min}px up until you add narrower variants.` : 'New images show at every width until you add variants for wider screens.',
      ),
    );
    foot.className = 'foot';
    foot.replaceChildren(h('span', { class: 'hint' }, 'Settings are shared by every site.'));
  }

  function renderCrumbs(group) {
    if (group) {
      const missing = !PM.elements.resolve(group);
      crumbs.replaceChildren(
        h('button', { class: 'crumb-back', title: 'Back to all layers (Esc)', onclick: () => PM.app.exitGroup() }, icon('back', 14), 'Layers'),
        h('span', { class: 'crumb-sep' }, '/'),
        h(
          'span',
          { class: 'crumb-here' + (missing ? ' warn' : ''), title: group.selector },
          icon(missing ? 'warn' : 'target', 14),
          h('span', null, group.name),
        ),
      );
      return;
    }
    const extra = PM.model.layers.length > 1 ? [h('span', { class: 'crumb-note' }, 'top of the list is in front')] : [];
    crumbs.replaceChildren(h('span', { class: 'crumb-here' }, 'Layers'), ...extra);
  }

  function renderList(group) {
    const items = group ? group.children : PM.model.layers;
    const scroll = list.scrollTop;
    list.replaceChildren(...(items.length ? items.map((n) => row(n, group, items)) : [empty(group)]));
    list.scrollTop = scroll;
  }

  function empty(group) {
    const browse = h('button', { class: 'link', onclick: () => fileInput.click() }, 'browse');
    if (group) {
      return h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty-title' }, 'Nothing attached yet'),
        h('p', { class: 'empty-sub' }, 'Drop an image here or ', browse, ' — it will follow ', h('code', null, group.name), '.'),
      );
    }
    return h(
      'div',
      { class: 'empty' },
      PM.mark(40, true),
      h('p', { class: 'empty-title' }, 'Nothing overlaid yet'),
      h('p', { class: 'empty-sub' }, 'Drop a mockup here, paste one,', h('br'), 'or ', browse, ' your files.'),
    );
  }

  function thumb(layer) {
    const v = PM.variants.shown(layer) || layer.variants[0];
    const url = PM.imageUrl(v.img);
    if (url === undefined) PM.ensureImage(v.img);
    if (url === null) return h('span', { class: 'thumb missing', title: 'Image missing' }, icon('warn', 14));
    return h('span', { class: 'thumb' }, url ? h('img', { src: url, alt: '' }) : null);
  }

  function groupThumb(group) {
    const first = group.children[0]?.variants[0];
    const url = first && PM.imageUrl(first.img);
    if (first && url === undefined) PM.ensureImage(first.img);
    return h(
      'span',
      { class: 'thumb grp' },
      url ? h('img', { src: url, alt: '' }) : icon('stack', 14),
      h('span', { class: 'badge' }, icon('target', 11)),
    );
  }

  function row(n, group, items) {
    const isGroup = n.type === 'group';
    const selected = PM.ui.selected === n.id;
    const nameEl = h('span', { class: 'name', title: isGroup ? `${n.name} — double-click to open` : n.name }, n.name);
    const tail = [];
    if (isGroup) {
      if (!PM.elements.resolve(n)) {
        tail.push(h('span', { class: 'warn-dot', title: 'Element not found on this page' }, icon('warn', 14)));
      }
      tail.push(h('span', { class: 'count', title: `${n.children.length} attached` }, n.children.length));
    } else {
      const v = PM.variants.active(n);
      if (!v) {
        const first = n.variants[0];
        tail.push(h('span', { class: 'vtag off', title: `Hidden at ${innerWidth}px. Shows from ${PM.variants.min(first)}px up.` }, `${PM.variants.min(first)}+`));
      } else if (n.variants.length > 1) {
        tail.push(h('span', { class: 'vtag', title: `${n.variants.length} variants. Showing ${PM.variants.name(v)} at ${innerWidth}px.` }, PM.variants.name(v)));
      }
      if (v?.blend && v.blend !== 'normal') {
        tail.push(h('span', { class: 'glyph', title: v.blend === 'difference' ? 'Difference' : 'Invert' }, icon('difference', 14)));
      }
      if (!group && v?.mode === 'screen') {
        tail.push(h('span', { class: 'glyph', title: 'Stays put on screen' }, icon('screen', 14)));
      }
      tail.push(
        ib(
          n.locked ? 'lock' : 'unlock',
          n.locked ? 'Unlock' : 'Lock — clicks pass through to the page',
          () => PM.app.update(n.id, { locked: !n.locked }, 'struct'),
          n.locked ? 'keep' : '',
        ),
      );
    }
    tail.push(
      ib(n.visible ? 'eye' : 'eyeOff', n.visible ? 'Hide' : 'Show', () => PM.app.update(n.id, { visible: !n.visible }, 'struct'), n.visible ? '' : 'keep'),
    );
    if (isGroup) tail.push(ib('chevron', 'Open group', () => PM.app.enterGroup(n.id), 'keep'));

    const r = h(
      'div',
      {
        class: `row${selected ? ' sel' : ''}${n.visible ? '' : ' off'}${isGroup ? ' grp' : ''}${!isGroup && !PM.variants.active(n) ? ' away' : ''}`,
        dataset: { id: n.id },
      },
      isGroup ? groupThumb(n) : thumb(n),
      nameEl,
      tail,
    );
    r.addEventListener('pointerdown', (e) => rowDrag(e, n, r, items));
    r.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, input')) return;
      if (isGroup) PM.app.enterGroup(n.id);
      else rename(nameEl, n);
    });
    return r;
  }

  function rename(span, n) {
    const input = h('input', { class: 'rename', spellcheck: 'false', value: n.name });
    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (keep && name && name !== n.name) PM.app.update(n.id, { name, autoName: false }, 'struct');
      else render();
    };
    input.addEventListener('pointerdown', stop);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    span.replaceWith(input);
    input.focus();
    input.select();
  }

  function rowDrag(e, n, rowEl, items) {
    if (e.button !== 0 || e.target.closest('button, input')) return;
    const sy = e.clientY;
    const from = items.indexOf(n);
    const rects = [...list.querySelectorAll('.row')].map((r) => r.getBoundingClientRect());
    const listRect = list.getBoundingClientRect();
    let dragging = false;
    let to = from;
    let line = null;
    rowEl.setPointerCapture(e.pointerId);

    const move = (ev) => {
      const dy = ev.clientY - sy;
      if (!dragging) {
        if (Math.abs(dy) < 4) return;
        dragging = true;
        rowEl.classList.add('lifted');
        line = h('div', { class: 'drop-line' });
        list.append(line);
      }
      rowEl.style.transform = `translateY(${dy}px)`;
      let i = rects.findIndex((r) => ev.clientY < r.top + r.height / 2);
      if (i < 0) i = rects.length;
      to = i;
      const y = i < rects.length ? rects[i].top : rects[rects.length - 1].bottom;
      line.style.top = y - listRect.top + list.scrollTop - 1 + 'px';
    };
    const up = () => {
      rowEl.removeEventListener('pointermove', move);
      rowEl.removeEventListener('pointerup', up);
      rowEl.removeEventListener('pointercancel', up);
      if (!dragging) return PM.app.select(n.id);
      PM.app.move(items, from, to > from ? to - 1 : to);
    };
    rowEl.addEventListener('pointermove', move);
    rowEl.addEventListener('pointerup', up);
    rowEl.addEventListener('pointercancel', up);
  }

  function renderProps(group) {
    const f = PM.model.find(PM.ui.selected);
    let node = f?.node;
    let parent = f?.parent;
    if (!node && group) {
      node = group;
      parent = null;
    }
    props.hidden = !node;
    props.replaceChildren(...(node ? (node.type === 'group' ? groupProps(node) : imageProps(node, parent)) : []));
  }

  const ANCHOR_WORDS = {
    tl: 'top left', tc: 'top', tr: 'top right',
    ml: 'left', mc: 'center', mr: 'right',
    bl: 'bottom left', bc: 'bottom', br: 'bottom right',
  };

  const DEFAULTS = { opacity: 0.5, scale: 1 };

  const isDefault = (v, key) => (key === 'pos' ? !v.x && !v.y : PM.r2(v[key]) === DEFAULTS[key]);

  const resetBtn = (v, key, title, run) =>
    h(
      'button',
      {
        class: 'ib reset' + (isDefault(v, key) ? ' dim' : ''),
        title,
        'aria-label': title,
        dataset: { reset: key },
        onclick: run,
      },
      icon('reset', 14),
    );

  function sliderField(label, l, v, key, o) {
    const value = () => PM.r2(v[key] * o.mul);
    const slider = h('input', {
      type: 'range',
      class: 'slider',
      min: o.min,
      max: o.max,
      step: 1,
      'aria-label': label,
      dataset: { f: key, mul: o.mul, min: o.min, max: o.max, kind: 'range' },
      value: PM.clamp(value(), o.min, o.max),
      oninput: (e) => PM.app.update(l.id, { [key]: e.target.value / o.mul }),
    });
    slider.style.setProperty('--p', PM.clamp((value() - o.min) / (o.max - o.min), 0, 1) * 100 + '%');
    return h(
      'div',
      { class: 'field slide' },
      lab(label),
      slider,
      num(null, l, v, key, { mul: o.mul, unit: o.unit, min: o.floor }),
      resetBtn(v, key, `Reset to ${DEFAULTS[key] * o.mul}${o.unit}`, () => PM.app.update(l.id, { [key]: DEFAULTS[key] }, 'struct')),
    );
  }

  const widths = (from, to) =>
    to === Infinity ? (from ? `from ${from}px up` : 'at every width') : from ? `from ${from} to ${to}px` : `up to ${to}px`;

  function variantStrip(l) {
    const target = PM.variants.target(l);
    const active = PM.variants.active(l);
    const many = l.variants.length > 1;
    const tabs = l.variants.map((v) => {
      const [from, to] = PM.variants.range(l, v);
      return h(
        'div',
        { class: `vtab${v === target ? ' on' : ''}${v === active ? ' here' : ''}` },
        h(
          'button',
          {
            class: 'vtab-main',
            title: `${PM.variants.name(v)}: shows ${widths(from, to)}${v === active ? ' · what your window shows now' : ''}`,
            onclick: () => PM.app.editVariant(v.id),
          },
          h('span', { class: 'vtab-name' }, PM.variants.name(v)),
          h('span', { class: 'vtab-min' }, `${PM.variants.min(v)}+`),
        ),
        many && v === target
          ? h(
              'button',
              { class: 'vtab-x', title: `Remove the ${PM.variants.name(v)} variant`, 'aria-label': 'Remove variant', onclick: () => PM.app.removeVariant(l.id, v.id) },
              icon('close', 12),
            )
          : null,
      );
    });
    const add = h(
      'button',
      {
        class: 'vtab-add' + (addingVariant ? ' on' : ''),
        title: 'Add a variant for another screen size',
        'aria-label': 'Add variant',
        onclick: () => {
          addingVariant = !addingVariant;
          renderProps(PM.ui.group ? PM.model.find(PM.ui.group)?.node : null);
        },
      },
      icon('plus', 14),
    );

    const [from, to] = PM.variants.range(l, target);
    const span = widths(from, to);
    const hint = many
      ? `${PM.variants.name(target)} shows ${span}.`
      : `Shows ${span}. Add a variant to change it on other screens.`;
    const out = [
      h('div', { class: 'vstrip' }, h('div', { class: 'vtabs' }, tabs, add)),
      h(
        'p',
        { class: 'hint vhint' },
        hint,
        target !== active ? h('span', { class: 'preview' }, ` Previewing — your window is ${innerWidth}px.`) : null,
      ),
    ];
    if (addingVariant) out.push(variantPicker(l));
    return out;
  }

  function variantPicker(l) {
    const used = new Set(l.variants.map(PM.variants.min));
    const free = PM.bp.list().filter((b) => !used.has(b.min));
    const custom = h('input', { class: 'num', inputmode: 'numeric', placeholder: String(innerWidth), 'aria-label': 'Custom minimum width' });
    const addCustom = () => {
      const n = parseInt(custom.value || custom.placeholder, 10);
      if (!Number.isFinite(n)) return custom.focus();
      addingVariant = false;
      PM.app.addVariant(l.id, null, n);
    };
    custom.addEventListener('keydown', (e) => e.key === 'Enter' && addCustom());
    const pickBp = (b) => {
      addingVariant = false;
      PM.app.addVariant(l.id, b);
    };
    return h(
      'div',
      { class: 'vadd' },
      free.length
        ? h(
            'div',
            { class: 'vadd-bps' },
            free.map((b) => h('button', { class: 'chip', title: `Shows from ${b.min}px up`, onclick: () => pickBp(b) }, `${b.name} `, h('span', { class: 'chip-min' }, `${b.min}+`))),
          )
        : null,
      h(
        'div',
        { class: 'vadd-custom' },
        h('span', { class: 'lab' }, 'Custom'),
        h('div', { class: 'numf' }, custom, h('span', { class: 'unit' }, 'px+')),
        btn(null, 'Add', addCustom, 'Add a variant from this width up', 'small'),
      ),
    );
  }

  function imageProps(l, group) {
    const v = PM.variants.target(l);
    const out = [
      ...variantStrip(l),
      sliderField('Opacity', l, v, 'opacity', { min: 0, max: 100, mul: 100, unit: '%', floor: 0 }),
      sliderField('Size', l, v, 'scale', { min: 10, max: 200, mul: 100, unit: '%', floor: 1 }),
      h(
        'div',
        { class: 'field slide' },
        lab('Offset'),
        h('div', { class: 'nums' }, num('X', l, v, 'x'), num('Y', l, v, 'y')),
        resetBtn(v, 'pos', group ? 'Back to the anchor point' : v.mode === 'screen' ? 'Back to the top left of the screen' : 'Back to the top left of the page', () =>
          PM.app.update(l.id, { x: 0, y: 0 }, 'struct'),
        ),
      ),
    ];

    if (group) {
      out.push(
        h(
          'div',
          { class: 'field' },
          lab('Anchor'),
          h(
            'div',
            { class: 'anchor-wrap' },
            h(
              'div',
              { class: 'anchor', role: 'group', 'aria-label': 'Anchor' },
              Object.keys(PM.ANCHORS).map((a) =>
                h('button', {
                  class: v.anchor === a ? 'on' : '',
                  title: `Pin to the element's ${ANCHOR_WORDS[a]}`,
                  'aria-label': ANCHOR_WORDS[a],
                  onclick: () => PM.app.setAnchor(l.id, a),
                }),
              ),
            ),
            h('span', { class: 'hint' }, `Offset is measured from the element's ${ANCHOR_WORDS[v.anchor] || 'top left'}.`),
          ),
        ),
      );
    } else {
      const opt = (mode, label, name, title) =>
        h('button', { class: v.mode === mode ? 'on' : '', title, onclick: () => PM.app.setMode(l.id, mode) }, icon(name, 14), label);
      out.push(
        h(
          'div',
          { class: 'field' },
          lab('Stick to'),
          h(
            'div',
            { class: 'seg' },
            opt('page', 'Page', 'page', 'Scrolls with the page'),
            opt('screen', 'Screen', 'screen', 'Stays in the same spot on screen while you scroll'),
          ),
        ),
      );
    }

    const blend = v.blend || 'normal';
    const mode = (b, label, title) =>
      h('button', { class: blend === b ? 'on' : '', title, onclick: () => PM.app.setBlend(l.id, b) }, label);
    out.push(
      h(
        'div',
        { class: 'field' },
        lab('Compare'),
        h(
          'div',
          { class: 'seg' },
          mode('normal', 'Normal', 'The image as it is'),
          mode('difference', 'Difference', 'Matching pixels turn black (D)'),
          mode('invert', 'Invert', 'Matching pixels turn grey, the page keeps its colors (D)'),
        ),
      ),
    );
    if (blend !== 'normal') {
      out.push(
        h(
          'p',
          { class: 'hint compare-hint' },
          blend === 'difference'
            ? 'Black means a match. Anything bright is off.'
            : 'Grey means a match at 50% opacity. Colored edges show what’s off, in the page’s own colors.',
        ),
      );
    }

    out.push(
      h(
        'div',
        { class: 'actions' },
        group
          ? [
              btn('unlink', 'Detach', () => PM.app.detach(l.id), 'Move back to the page layers'),
              btn('target', '', () => PM.app.attach(l.id), 'Attach to a different element'),
            ]
          : btn('target', 'Attach', () => PM.app.attach(l.id), 'Attach to an element: pick one on the page for this layer to follow'),
        btn('replace', 'Replace', () => chooseImage(l.id, v.id), `Swap in a different image for ${PM.variants.name(v)}, keeping its position and settings`),
        h('span', { class: 'spacer' }),
        ib('trash', 'Delete layer (Del)', () => PM.app.remove(l.id), 'danger'),
      ),
    );
    return out;
  }

  function chooseImage(layer, variant) {
    replaceTarget = { layer, variant };
    replaceInput.click();
  }

  function num(label, l, v, key, o = {}) {
    const mul = o.mul || 1;
    const get = () => PM.r2(v[key] * mul);
    const set = (val) => {
      if (!Number.isFinite(val)) return;
      if (o.min != null) val = Math.max(o.min, val);
      PM.app.update(l.id, { [key]: val / mul });
    };
    const input = h('input', {
      class: 'num',
      spellcheck: 'false',
      inputmode: 'decimal',
      'aria-label': label || key,
      dataset: { f: key, mul },
      value: String(get()),
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        set(parseFloat(input.value));
        input.blur();
      } else if (e.key === 'Escape') {
        input.value = get();
        input.blur();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        set(get() + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1));
        input.value = get();
      }
    });
    input.addEventListener('change', () => set(parseFloat(input.value)));
    input.addEventListener('blur', () => (input.value = get()));

    let scrub = null;
    if (label) {
      scrub = h('span', { class: 'scrub', title: 'Drag to adjust · Shift for ×10' }, label);
      scrub.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        scrub.setPointerCapture(e.pointerId);
        const sx = e.clientX;
        const sv = get();
        const move = (ev) => set(sv + Math.round(ev.clientX - sx) * (ev.shiftKey ? 10 : 1));
        const up = () => {
          scrub.removeEventListener('pointermove', move);
          scrub.removeEventListener('pointerup', up);
          scrub.removeEventListener('pointercancel', up);
          PM.panel.refresh();
        };
        scrub.addEventListener('pointermove', move);
        scrub.addEventListener('pointerup', up);
        scrub.addEventListener('pointercancel', up);
      });
    }

    return h('div', { class: 'numf' + (label ? '' : ' bare') }, scrub, input, o.unit ? h('span', { class: 'unit' }, o.unit) : null);
  }

  function groupProps(g) {
    const r = PM.elements.rect(g);
    const inside = PM.ui.group === g.id;
    const nameInput = h('input', { class: 'text', spellcheck: 'false', 'aria-label': 'Group name', value: g.name });
    nameInput.addEventListener('keydown', (e) => e.key === 'Enter' && nameInput.blur());
    nameInput.addEventListener('change', () => {
      const name = nameInput.value.trim();
      if (name) PM.app.update(g.id, { name, autoName: false }, 'struct');
    });
    return [
      h('div', { class: 'field' }, lab('Name'), nameInput),
      h('div', { class: 'field' }, lab('Element'), h('code', { title: g.selector }, g.selector)),
      r
        ? h('div', { class: 'hint' }, `${Math.round(r.width)} × ${Math.round(r.height)} — its layers move wherever it goes.`)
        : h('div', { class: 'hint warn' }, 'Can’t find this element right now. Re-pick it to bring its layers back.'),
      h(
        'div',
        { class: 'actions' },
        inside ? null : btn('chevron', 'Open', () => PM.app.enterGroup(g.id), 'Open the group (or double-click it)'),
        btn('target', 'Re-pick', () => PM.app.repick(g.id), 'Attach these layers to a different element'),
        btn('stack', 'Ungroup', () => PM.app.ungroup(g.id), 'Move the layers back to the page'),
        h('span', { class: 'spacer' }),
        ib('trash', 'Delete group and its layers', () => PM.app.remove(g.id), 'danger'),
      ),
    ];
  }

  function selectionChanged() {
    addingVariant = false;
    if (!el || el.hidden || PM.ui.view === 'settings') return;
    for (const r of list.querySelectorAll('.row')) r.classList.toggle('sel', r.dataset.id === PM.ui.selected);
    renderProps(PM.ui.group ? PM.model.find(PM.ui.group)?.node : null);
  }

  function refresh() {
    if (!el || props.hidden) return;
    const f = PM.model.find(PM.ui.selected);
    if (!f || f.node.type !== 'image') return;
    const v = PM.variants.target(f.node);
    const focused = PM.root.activeElement;
    for (const n of props.querySelectorAll('[data-f]')) {
      const val = PM.r2(v[n.dataset.f] * (+n.dataset.mul || 1));
      if (n.dataset.kind === 'range') {
        const min = +n.dataset.min;
        const max = +n.dataset.max;
        if (n !== focused) n.value = PM.clamp(val, min, max);
        n.style.setProperty('--p', PM.clamp((val - min) / (max - min), 0, 1) * 100 + '%');
      } else if (n !== focused) {
        n.value = String(val);
      }
    }
    for (const b of props.querySelectorAll('[data-reset]')) b.classList.toggle('dim', isDefault(v, b.dataset.reset));
  }

  function renderFoot(group) {
    if (PM.ui.picking) {
      foot.className = 'foot picking';
      foot.replaceChildren(
        h('span', { class: 'pulse' }),
        h('span', { class: 'pick-text' }, 'Click an element', h('span', { class: 'hint' }, kbd('↑'), ' parent  ', kbd('Esc'), ' cancel')),
        h('span', { class: 'spacer' }),
        btn(null, 'Cancel', () => PM.picker.cancel(), '', 'ghost'),
      );
      return;
    }
    foot.className = 'foot';
    const hasLayers = PM.model.layers.length > 0;
    foot.replaceChildren(
      btn('plus', group ? 'Add to group' : 'Add image', () => fileInput.click(), 'Add images — you can also drop or paste them', 'primary'),
      h('span', { class: 'spacer' }),
      hasLayers
        ? h('span', { class: 'hint' }, kbd('Alt'), ' drag without snapping')
        : h('span', { class: 'hint' }, kbd(isMac ? '⌘' : 'Ctrl'), ' ', kbd('V'), ' pastes'),
    );
  }

  function toast(msg, action) {
    if (!el) return;
    clearTimeout(toastTimer);
    const hide = () => toastEl.classList.remove('show');
    toastEl.replaceChildren(
      h('span', { class: 'toast-msg' }, msg),
      ...(action ? [h('button', { onclick: () => { hide(); action.run(); } }, action.label)] : []),
    );
    toastEl.classList.add('show');
    toastTimer = setTimeout(hide, action ? 5000 : 2800);
  }

  PM.panel = {
    mount,
    render,
    refresh,
    selectionChanged,
    chooseImage,
    toast,
    place,
    closeMenu,
    get menuOpen() {
      return !!menuEl && !menuEl.hidden;
    },
    get el() {
      return el;
    },
  };
})();
