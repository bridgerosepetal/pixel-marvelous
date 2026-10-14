(() => {
  const PM = globalThis.__pm;
  if (PM.css) return;

  PM.css = `
:host {
  all: initial !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  width: 0 !important;
  height: 0 !important;
  display: block !important;
  overflow: visible !important;
  pointer-events: none !important;
}

.pm {
  display: contents;
  --ink: #22201c;
  --ink-2: #57524a;
  --muted: #8d877c;
  --line: #ece7de;
  --line-2: #ddd6ca;
  --paper: #fcfbf8;
  --sunk: #f3f0ea;
  --hover: #f4f1eb;
  --sel: #fbede4;
  --accent: #e5532d;
  --accent-ink: #b8401f;
  --danger: #b3261e;
  --font: "Inter", "Segoe UI Variable Text", "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --mono: "JetBrains Mono", "SF Mono", ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace;
}

[hidden] { display: none !important; }

.doc { position: absolute; top: 0; left: 0; width: 0; height: 0; }
.fixed-stage { display: contents; }

.ov {
  position: absolute;
  top: 0;
  left: 0;
  max-width: none;
  max-height: none;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  outline: 0;
  pointer-events: auto;
  user-select: none;
  -webkit-user-drag: none;
  touch-action: none;
  cursor: grab;
}
.ov.screen { position: fixed; }
.ov.locked, .picking .ov { pointer-events: none; }
.ov.sel:hover, .ov.dragging { outline: 1px solid rgba(229, 83, 45, .75); }
.ov.dragging { cursor: grabbing; }

.guides { position: fixed; inset: 0; z-index: 2147483646; pointer-events: none; }
.guide { position: absolute; background: var(--accent); }
.guide.x { width: 1px; margin-left: -.5px; }
.guide.y { height: 1px; margin-top: -.5px; }
.target {
  position: absolute;
  outline: 1px dashed rgba(229, 83, 45, .9);
  background: rgba(229, 83, 45, .05);
}

.frame { position: absolute; outline: 1px dashed rgba(34, 32, 28, .55); outline-offset: 0; }
.frame-tag {
  position: absolute;
  left: -1px;
  bottom: 100%;
  margin-bottom: 4px;
  font: 500 10.5px/1 var(--mono);
  color: var(--paper);
  background: var(--ink);
  padding: 4px 6px;
  border-radius: 5px;
  white-space: nowrap;
}

.pick-box {
  position: fixed;
  z-index: 2147483646;
  pointer-events: none;
  background: rgba(229, 83, 45, .08);
  outline: 1.5px solid var(--accent);
  border-radius: 1px;
  transition: left .06s, top .06s, width .06s, height .06s;
}
.pick-tag {
  position: fixed;
  z-index: 2147483646;
  pointer-events: none;
  font: 500 11px/1 var(--mono);
  color: #fff;
  background: var(--ink);
  padding: 5px 7px;
  border-radius: 6px;
  white-space: nowrap;
}
.pick-tag span { color: #b9b2a6; margin-left: 6px; }

.panel {
  position: fixed;
  z-index: 2147483647;
  width: 288px;
  pointer-events: auto;
  font: 400 12.5px/1.4 var(--font);
  color: var(--ink);
  background: var(--paper);
  border: 1px solid var(--line-2);
  border-radius: 14px;
  box-shadow:
    0 1px 1px rgba(34, 32, 28, .04),
    0 2px 6px -2px rgba(34, 32, 28, .08),
    0 14px 34px -12px rgba(34, 32, 28, .3);
  overflow: hidden;
  outline: none;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  color-scheme: light;
}
.panel * { box-sizing: border-box; }
.panel.moving { box-shadow: 0 2px 6px -2px rgba(34, 32, 28, .1), 0 22px 44px -14px rgba(34, 32, 28, .38); }
.panel.drop { outline: 2px solid var(--accent); outline-offset: -2px; }

button {
  font: inherit;
  color: inherit;
  background: none;
  border: 0;
  margin: 0;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
button:focus-visible, input:focus-visible { outline: 2px solid rgba(229, 83, 45, .45); outline-offset: 1px; }

.mark { flex: none; color: var(--ink); overflow: visible; }
.mark-back { fill: none; stroke: currentColor; stroke-width: 1.5; }
.mark-front { fill: var(--accent); mix-blend-mode: multiply; }

.bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 6px 0 12px;
  cursor: grab;
  user-select: none;
}
.moving .bar { cursor: grabbing; }
.title { flex: 1; min-width: 0; font-weight: 600; letter-spacing: -.01em; white-space: nowrap; }
.title-count {
  display: none;
  margin-left: 6px;
  font: 500 10.5px/1 var(--mono);
  color: var(--muted);
}
.collapsed .title-count:not(:empty) { display: inline; }

.ib {
  flex: none;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 7px;
  color: var(--ink-2);
  transition: background .12s, color .12s;
}
.ib:hover { background: var(--hover); color: var(--ink); }
.ib:active { transform: translateY(.5px); }
.ib.on { color: var(--accent-ink); }
.ib.danger:hover { color: var(--danger); background: #fbeceb; }

.collapsed { width: auto; border-radius: 12px; }
.collapsed .body { display: none; }

.crumbs {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 12px 4px;
  border-top: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--muted);
}
.crumb-here { display: inline-flex; align-items: center; gap: 5px; min-width: 0; font-weight: 600; color: var(--ink); }
.crumb-here span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.crumb-here.warn { color: var(--danger); }
.crumb-note { margin-left: auto; }
.crumb-back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: -6px;
  padding: 3px 6px 3px 2px;
  border-radius: 6px;
  color: var(--ink-2);
}
.crumb-back:hover { background: var(--hover); color: var(--ink); }
.crumb-sep { color: var(--line-2); }

.list {
  position: relative;
  max-height: 260px;
  overflow: auto;
  padding: 2px 6px 8px;
  scrollbar-width: thin;
  scrollbar-color: var(--line-2) transparent;
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  gap: 9px;
  height: 38px;
  padding: 0 4px 0 6px;
  border-radius: 9px;
  user-select: none;
}
.row:hover { background: var(--hover); }
.row.sel { background: var(--sel); }
.row.off .thumb, .row.off .name { opacity: .42; }
.row.lifted {
  z-index: 2;
  background: var(--paper);
  box-shadow: 0 1px 2px rgba(34, 32, 28, .08), 0 8px 20px -8px rgba(34, 32, 28, .4);
}
.row .ib { width: 24px; height: 24px; opacity: 0; }
.row:hover .ib, .row .ib.keep, .row .ib:focus-visible { opacity: 1; }

.thumb {
  position: relative;
  flex: none;
  width: 34px;
  height: 24px;
  border-radius: 5px;
  overflow: hidden;
  background-color: #fff;
  background-image: conic-gradient(#efebe4 25%, transparent 0 50%, #efebe4 0 75%, transparent 0);
  background-size: 8px 8px;
  box-shadow: inset 0 0 0 1px rgba(34, 32, 28, .1);
}
.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top left;
}
.thumb.missing { display: grid; place-items: center; color: var(--danger); }
.thumb.grp {
  overflow: visible;
  display: grid;
  place-items: center;
  color: var(--ink-2);
  background: #f1ece3;
  box-shadow:
    inset 0 0 0 1px rgba(34, 32, 28, .1),
    3px -3px 0 -1px #f7f3ec,
    3px -3px 0 0 rgba(34, 32, 28, .14);
}
.thumb.grp img { border-radius: 5px; }
.thumb.grp .badge {
  position: absolute;
  right: -5px;
  bottom: -5px;
  display: grid;
  place-items: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: var(--paper);
  color: var(--accent-ink);
  box-shadow: 0 0 0 1px rgba(34, 32, 28, .12);
}

.name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row.sel .name { font-weight: 500; }
.rename {
  all: unset;
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  margin-left: -6px;
  border-radius: 6px;
  background: #fff;
  box-shadow: inset 0 0 0 1px var(--ink-2);
  font: inherit;
  color: var(--ink);
}
.count {
  flex: none;
  font: 500 10.5px/1 var(--mono);
  color: var(--ink-2);
  background: rgba(34, 32, 28, .06);
  padding: 3px 5px;
  border-radius: 5px;
}
.glyph { flex: none; display: grid; place-items: center; color: var(--muted); }
.warn-dot { flex: none; display: grid; place-items: center; color: var(--danger); }
.drop-line {
  position: absolute;
  left: 12px;
  right: 12px;
  height: 2px;
  border-radius: 2px;
  background: var(--accent);
  pointer-events: none;
}

.empty {
  margin: 2px 0 0;
  padding: 22px 16px 20px;
  border: 1.5px dashed var(--line-2);
  border-radius: 11px;
  text-align: center;
  color: var(--ink-2);
  transition: background .15s, border-color .15s;
}
.drop .empty { background: #fff5ef; border-color: var(--accent); }
.empty .mark { color: var(--ink-2); }
.empty-title { margin: 10px 0 3px; font-weight: 600; color: var(--ink); }
.empty-sub { margin: 0; color: var(--muted); line-height: 1.5; }
.link {
  color: var(--accent-ink);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}

.props {
  display: grid;
  gap: 10px;
  padding: 11px 12px 12px;
  border-top: 1px solid var(--line);
}
.field { display: grid; grid-template-columns: 54px minmax(0, 1fr) auto; align-items: center; gap: 8px; min-height: 28px; }
.lab { color: var(--muted); font-size: 11.5px; }
.val { width: 36px; text-align: right; font: 500 11.5px/1 var(--mono); color: var(--ink-2); font-variant-numeric: tabular-nums; }
.hint { color: var(--muted); font-size: 11px; line-height: 1.45; }
.hint.warn { color: var(--danger); }

.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 18px;
  margin: 0;
  background: transparent;
  cursor: pointer;
}
.slider::-webkit-slider-runnable-track {
  height: 3px;
  border-radius: 3px;
  background: linear-gradient(to right, var(--ink) var(--p, 50%), var(--line-2) var(--p, 50%));
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 14px;
  height: 14px;
  margin-top: -5.5px;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid var(--ink);
  box-shadow: 0 1px 2px rgba(34, 32, 28, .2);
  transition: transform .12s;
}
.slider:active::-webkit-slider-thumb { transform: scale(1.12); }
.slider:focus-visible { outline: none; }
.slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 3px rgba(229, 83, 45, .3); }

.nums { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.numf {
  display: flex;
  align-items: center;
  height: 28px;
  padding-left: 8px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: #fff;
  transition: border-color .12s, box-shadow .12s;
}
.numf:focus-within { border-color: var(--ink-2); box-shadow: 0 0 0 3px rgba(34, 32, 28, .07); }
.scrub { flex: none; padding-right: 6px; color: var(--muted); font-size: 11px; cursor: ew-resize; user-select: none; }
.scrub:hover { color: var(--ink); }
.num {
  all: unset;
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 100%;
  font: 500 12px/1 var(--mono);
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.unit { flex: none; padding-right: 7px; color: var(--muted); font: 500 11px/1 var(--mono); }

.seg { display: flex; gap: 2px; padding: 2px; border-radius: 8px; background: var(--sunk); }
.seg button {
  flex: 1;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  border-radius: 6px;
  font-size: 11.5px;
  color: var(--ink-2);
  transition: background .12s, color .12s;
}
.seg button:hover { color: var(--ink); }
.seg button.on {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 1px 2px rgba(34, 32, 28, .12), 0 0 0 1px rgba(34, 32, 28, .04);
}

.anchor-wrap { display: flex; align-items: center; gap: 10px; }
.anchor {
  display: grid;
  grid-template-columns: repeat(3, 12px);
  gap: 4px;
  padding: 5px;
  border-radius: 8px;
  background: var(--sunk);
}
.anchor button { display: grid; place-items: center; width: 12px; height: 12px; }
.anchor button::after {
  content: '';
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #bdb5a8;
  transition: all .12s;
}
.anchor button:hover::after { background: var(--ink-2); }
.anchor button.on::after { width: 8px; height: 8px; background: var(--accent); }

code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: 500 11.5px/1.3 var(--mono);
  color: var(--ink);
  background: var(--sunk);
  padding: 3px 6px;
  border-radius: 6px;
}
.text {
  all: unset;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: #fff;
  font: inherit;
  color: var(--ink);
}
.text:focus { border-color: var(--ink-2); box-shadow: 0 0 0 3px rgba(34, 32, 28, .07); }

.actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.spacer { flex: 1; }
.btn {
  height: 28px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--line-2);
  border-radius: 8px;
  background: #fff;
  color: var(--ink);
  font-weight: 500;
  white-space: nowrap;
  transition: background .12s, border-color .12s, color .12s;
}
.btn:hover { border-color: #cbc3b5; background: #fffdfa; }
.btn:active { transform: translateY(.5px); }
.btn.icon { width: 28px; padding: 0; justify-content: center; }
.btn.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.btn.primary { background: var(--ink); border-color: var(--ink); color: #fff; }
.btn.primary:hover { background: #000; }
.btn.ghost { border-color: transparent; background: none; color: var(--ink-2); }
.btn.ghost:hover { background: var(--hover); color: var(--ink); }

.foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 8px 8px;
  border-top: 1px solid var(--line);
  background: #f8f6f1;
}
.foot .hint { white-space: nowrap; }
kbd {
  display: inline-block;
  min-width: 16px;
  padding: 2px 4px;
  border: 1px solid var(--line-2);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: #fff;
  font: 500 10px/1 var(--mono);
  color: var(--ink-2);
  text-align: center;
}
.foot.picking { padding-left: 12px; background: #fff6f0; }
.pick-text { display: flex; flex-direction: column; gap: 3px; font-weight: 500; }
.pulse {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: pm-pulse 1.4s ease-out infinite;
}
@keyframes pm-pulse {
  0% { box-shadow: 0 0 0 0 rgba(229, 83, 45, .55); }
  100% { box-shadow: 0 0 0 9px rgba(229, 83, 45, 0); }
}

.toast {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 7px;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 8px 8px 12px;
  border-radius: 10px;
  background: var(--ink);
  color: #f4efe6;
  font-size: 12px;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity .18s ease, transform .18s ease;
  pointer-events: none;
}
.toast.show { opacity: 1; transform: none; pointer-events: auto; }
.toast-msg { flex: 1; min-width: 0; }
.toast button { padding: 3px 6px; border-radius: 6px; color: #ffb196; font-weight: 600; }
.toast button:hover { background: rgba(255, 255, 255, .08); }
.collapsed .toast { display: none; }

.chip {
  flex: none;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--line-2);
  border-radius: 6px;
  background: #fff;
  color: var(--ink);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
}
.chip:hover { border-color: #cbc3b5; }
.vstrip { margin: 0 -2px; }
.vtabs { display: flex; flex-wrap: wrap; gap: 4px; }
.vtab {
  position: relative;
  display: flex;
  align-items: stretch;
  border-radius: 8px;
  background: var(--sunk);
  color: var(--ink-2);
  transition: background .12s, color .12s, box-shadow .12s;
}
.vtab:hover { color: var(--ink); }
.vtab.on {
  background: #fff;
  color: var(--ink);
  box-shadow: inset 0 0 0 1.5px var(--ink);
}
.vtab-main { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 5px 9px 6px; }
.vtab-name { font-size: 11.5px; font-weight: 500; line-height: 1.2; white-space: nowrap; }
.vtab-min { font: 500 9.5px/1 var(--mono); opacity: .75; }
.vtab.here .vtab-name::after {
  content: '';
  display: inline-block;
  width: 5px;
  height: 5px;
  margin-left: 5px;
  border-radius: 50%;
  background: var(--accent);
  vertical-align: 1px;
}
.vtab-x { display: grid; place-items: center; width: 20px; margin-left: -6px; padding-right: 4px; color: var(--muted); }
.vtab-x:hover { color: var(--danger); }
.vtab-add {
  display: grid;
  place-items: center;
  width: 32px;
  border: 1px dashed var(--line-2);
  border-radius: 8px;
  color: var(--ink-2);
}
.vtab-add:hover, .vtab-add.on { border-color: var(--ink-2); color: var(--ink); background: #fff; }
.vhint { margin: -4px 0 0; }
.vhint .preview { color: var(--accent-ink); }
.vadd {
  display: grid;
  gap: 8px;
  margin-top: -2px;
  padding: 10px;
  border-radius: 10px;
  background: var(--sunk);
}
.vadd-bps { display: flex; flex-wrap: wrap; gap: 4px; }
.vadd-bps .chip { height: 26px; }
.chip-min { font: 500 9.5px/1 var(--mono); color: var(--muted); }
.vadd-custom { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.vadd-custom .numf { height: 26px; }
.btn.small { height: 26px; padding: 0 9px; font-size: 11.5px; }

.vtag {
  flex: none;
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10.5px;
  font-weight: 500;
  color: var(--ink-2);
  background: rgba(34, 32, 28, .06);
  padding: 3px 6px;
  border-radius: 5px;
}
.vtag.off { font: 500 10px/1 var(--mono); color: var(--muted); background: none; box-shadow: inset 0 0 0 1px var(--line-2); padding: 4px 5px; }
.row.away .thumb, .row.away .name { opacity: .45; }

.list.tall { max-height: none; overflow: visible; }
.set-title { margin: 8px 6px 4px; font-size: 10.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.set-intro { margin: 0 6px 10px; }
.set-row { display: flex; align-items: center; gap: 6px; margin: 2px 4px 12px; }
.seg.wrap { flex-wrap: wrap; margin: 4px 4px 6px; }
.seg.wrap button { flex: 1 0 auto; padding: 0 8px; }

.body { max-height: calc(100vh - 74px); overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--line-2) transparent; }

.menu {
  position: absolute;
  top: 40px;
  right: 8px;
  z-index: 3;
  width: 204px;
  padding: 4px;
  border: 1px solid var(--line-2);
  border-radius: 10px;
  background: var(--paper);
  box-shadow: 0 10px 28px -10px rgba(34, 32, 28, .35);
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  height: 30px;
  padding: 0 8px;
  border-radius: 7px;
  color: var(--ink);
  text-align: left;
}
.menu-item svg { color: var(--ink-2); }
.menu-item:hover { background: var(--hover); }
.menu-hint { margin-left: auto; color: var(--muted); font-size: 10.5px; }
.menu-sep { height: 1px; margin: 4px 6px; background: var(--line); }

.bprow { display: grid; grid-template-columns: minmax(0, 1fr) 98px 24px; gap: 6px; align-items: center; margin: 0 4px 6px; }
.bprow .numf { padding-left: 8px; }
.num:disabled { color: var(--muted); }
.ib-spacer { width: 24px; }

.field.slide { grid-template-columns: 54px minmax(0, 1fr) 64px 24px; gap: 6px 8px; }
.field.slide .nums { grid-column: span 2; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.ib.reset { width: 24px; height: 24px; }
.ib.reset.dim { opacity: .28; }
.compare-hint { margin: -4px 0 0 62px; }

@media (prefers-reduced-motion: reduce) {
  .pulse { animation: none; }
  .toast, .pick-box { transition: none; }
}
`;
})();
