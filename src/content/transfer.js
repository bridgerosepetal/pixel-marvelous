(() => {
  const PM = globalThis.__pm;
  if (PM.transfer) return;
  const FORMAT = 'pixel-marvelous';

  const slug = (s) =>
    s
      .toLowerCase()
      .replace(/^www\./, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'page';

  const fileName = () => slug(location.hostname + location.pathname) + '.pixel.json';

  async function snapshot() {
    const images = await PM.store.readImages([...PM.model.usedImages()]);
    return {
      format: FORMAT,
      version: 2,
      savedAt: new Date().toISOString(),
      page: location.origin + location.pathname,
      title: document.title,
      breakpoints: structuredClone(PM.store.breakpoints),
      layers: structuredClone(PM.store.page.layers),
      images,
    };
  }

  async function download() {
    const blob = new Blob([JSON.stringify(await snapshot())], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = PM.h('a', { href: url, download: fileName() });
    PM.wrap.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function readFile(file) {
    let data;
    try {
      data = JSON.parse(await file.text());
    } catch {
      throw new Error('That file isn’t valid JSON.');
    }
    return data;
  }

  async function apply(data) {
    if (!data || data.format !== FORMAT || (!Array.isArray(data.layers) && typeof data.states !== 'object')) {
      throw new Error('That isn’t a Pixel Marvelous file.');
    }

    const theirs = new Map((data.breakpoints || []).map((b) => [b.id, b]));
    const matchBp = (id, min) => {
      const known = PM.bp.byId(id);
      if (known) return { bp: known.id, min: known.min };
      const width = theirs.get(id)?.min ?? min ?? 0;
      return { bp: PM.bp.byMin(width)?.id ?? null, min: width };
    };
    let layers = PM.migrate(data.layers ? { layers: data.layers } : { states: data.states }, (id) => {
      const m = matchBp(id);
      return { id: m.bp, min: m.min };
    });

    const imgMap = {};
    for (const [oldId, dataUrl] of Object.entries(data.images || {})) {
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
      const id = PM.uid();
      await PM.store.putImage(id, dataUrl);
      imgMap[oldId] = id;
    }

    const image = (l) => {
      const variants = (l.variants || []).map((v) =>
        PM.model.newVariant({ ...v, id: PM.uid(), img: imgMap[v.img] ?? v.img, ...matchBp(v.bp, v.min) }),
      );
      const layer = { id: PM.uid(), type: 'image', name: l.name || 'Layer', visible: l.visible !== false, locked: !!l.locked, variants };
      PM.variants.sort(layer);
      return layer;
    };
    layers = layers
      .map((n) =>
        n.type === 'group'
          ? { visible: true, autoName: false, ...n, id: PM.uid(), children: (n.children || []).map(image).filter((c) => c.variants.length) }
          : image(n),
      )
      .filter((n) => (n.type === 'group' ? true : n.variants.length));

    const previous = PM.store.page;
    PM.store.page = { v: 3, layers };
    return previous;
  }

  PM.transfer = { snapshot, download, readFile, apply, fileName };
})();
