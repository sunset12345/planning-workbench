/* Export the current document and its attachments as one consistent snapshot. */
(() => {
  const encoder = new TextEncoder();
  const bytes = text => encoder.encode(text);
  const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', value))].map(n => n.toString(16).padStart(2, '0')).join('');
  const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
  const encode = array => { let s = ''; for (const n of array) s += String.fromCharCode(n); return btoa(s); };
  const jsonText = value => JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
  const notice = text => { const t = document.querySelector('#toast'); t.textContent = text; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 6000); };

  async function snapshot() {
    if (document.querySelector('#editor').open) throw Error('请先应用或取消当前图示编辑，再保存。');
    const root = document.documentElement.cloneNode(true);
    const meta = JSON.parse(root.querySelector('#planning-meta').textContent);
    const graphs = window.lotteryEditor.getGraphs();
    root.querySelector('#graph-data').textContent = jsonText(graphs);
    root.querySelectorAll('dialog').forEach(d => d.removeAttribute('open'));
    root.querySelector('#editor-body').replaceChildren();
    root.querySelector('#viewer-body').replaceChildren();
    root.querySelectorAll('.mindmap-controls,.mindmap-dialog-tools').forEach(e => e.remove());
    root.querySelectorAll('.mindmap-viewport').forEach(e => {
      e.classList.remove('mindmap-viewport', 'is-panning');
      if (!e.className) e.removeAttribute('class');
      e.removeAttribute('tabindex');
      for (const key of ['scale', 'panX', 'panY']) delete e.dataset[key];
    });
    root.querySelector('#editor-error').textContent = '';
    root.querySelector('#editor-title').textContent = '编辑图示';
    root.querySelector('#editor').classList.remove('visual-editor');
    root.querySelector('#search').setAttribute('value', '');
    root.querySelector('#search-status').textContent = '';
    root.querySelector('#toggle-tables').textContent = '折叠全部表格';
    root.querySelectorAll('.chapter,.table-wrap').forEach(e => e.removeAttribute('hidden'));
    root.querySelectorAll('.graph-stage').forEach(e => e.replaceChildren());
    root.querySelector('#toast').textContent = '';
    root.querySelector('#toast').style.display = 'none';
    const assets = JSON.parse(root.querySelector('#planning-assets').textContent);
    // Keep exported SVG source files equal to their current editable page figures.
    for (const fig of root.querySelectorAll('.ui-figure')) {
      const asset = assets.find(a => a.path === `图示/${fig.dataset.ui}.svg`);
      if (asset) asset.data = encode(bytes(fig.querySelector('.ui-art').innerHTML));
    }
    root.querySelector('#planning-assets').textContent = jsonText(assets);
    const html = '<!doctype html>\n' + root.outerHTML;
    const files = assets.map(a => ({ path: a.path, data: decode(a.data) }));
    const attachments = await Promise.all(assets.map(async (a, i) => ({ id: a.id, path: a.path, name: a.name, mediaType: a.mediaType, role: a.role, sha256: await digest(files[i].data) })));
    const anchorBlocks = new Map();
    const attachmentPaths = new Map(assets.map(a => [a.path, a.id]));
    for (const s of root.querySelectorAll('.chapter')) {
      const first = s.querySelector('[data-block-id]');
      if (first) anchorBlocks.set(s.id, first.dataset.blockId);
    }
    for (const b of root.querySelectorAll('[data-block-id]')) {
      anchorBlocks.set(b.dataset.anchor, b.dataset.blockId);
      b.querySelectorAll('[id]').forEach(el => anchorBlocks.set(el.id, b.dataset.blockId));
    }
    const diagrams = [];
    for (const [key, source] of Object.entries(graphs)) {
      const card = root.querySelector(`[data-graph="${key}"]`);
      const data = structuredClone(source);
      for (const n of data.nodes) {
        delete n.targetId;
        if (key === 'M01' && n.id === 'root') n.targetId = meta.document.ownerId;
        else if (n.href?.startsWith('#')) n.targetId = anchorBlocks.get(n.href.slice(1));
      }
      diagrams.push({ id: meta.diagrams[key], kind: key === 'M01' ? 'mindmap' : key === 'F01' ? 'flow' : 'config', blockId: card.closest('[data-block-id]').dataset.blockId, sourceFormat: 'json', sourceData: data });
    }
    for (const fig of root.querySelectorAll('.ui-figure')) diagrams.push({ id: meta.diagrams[fig.dataset.ui], kind: 'ui', blockId: fig.closest('[data-block-id]').dataset.blockId, sourceFormat: 'svg', sourceData: fig.querySelector('.ui-art').innerHTML });
    const relations = [];
    const sections = [...root.querySelectorAll('.chapter')].map(section => ({
      id: section.dataset.sectionId, title: section.querySelector('h2').textContent, categoryKey: section.dataset.category,
      blocks: [...section.querySelectorAll(':scope > [data-block-id]')].map(block => {
        const references = [];
        const add = (kind, targetId) => { if (targetId && !references.some(r => r.kind === kind && r.targetId === targetId)) references.push({ kind, targetId }); };
        block.querySelectorAll('a[href]').forEach(a => {
          const href = a.getAttribute('href');
          if (href.startsWith('#')) add('block', anchorBlocks.get(href.slice(1)));
          else add('attachment', attachmentPaths.get(decodeURIComponent(href.split('#')[0])));
        });
        for (const d of diagrams.filter(d => d.blockId === block.dataset.blockId)) add('diagram', d.id);
        for (const r of references.filter(r => r.kind === 'block' && r.targetId !== block.dataset.blockId)) relations.push({ id: `ref:${block.dataset.blockId}:${r.targetId}`, fromId: block.dataset.blockId, toId: r.targetId, relationType: 'references' });
        const content = block.cloneNode(true);
        content.querySelectorAll('.graph-tools, .graph-stage, button, script').forEach(el => el.remove());
        content.querySelectorAll('[hidden]').forEach(el => el.removeAttribute('hidden'));
        return { id: block.dataset.blockId, title: block.querySelector('h3,h4')?.textContent || section.querySelector('h2').textContent, subtype: block.dataset.subtype, anchor: block.dataset.anchor, contentHtml: content.innerHTML, references };
      })
    }));
    const planning = {
      format: meta.format, schemaVersion: meta.schemaVersion, packageId: crypto.randomUUID(), exportedAt: new Date().toISOString(),
      source: { htmlPath: '简单抽奖策划案.html', htmlSha256: await digest(bytes(html)), maintenanceOwner: 'html', workbenchOrigin: null },
      project: meta.project, systems: meta.systems, features: meta.features,
      document: { ...meta.document, sections }, relations, diagrams, attachments
    };
    return { html, planning, files };
  }

  function zip(files) {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c; }
    const crc = data => { let c = 0xffffffff; for (const n of data) c = table[(c ^ n) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
    const local = [], central = []; let offset = 0, size = 0;
    for (const file of files) {
      const name = bytes(file.path), data = file.data, sum = crc(data);
      const h = new Uint8Array(30), v = new DataView(h.buffer);
      v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x800, true); v.setUint16(12, 33, true);
      v.setUint32(14, sum, true); v.setUint32(18, data.length, true); v.setUint32(22, data.length, true); v.setUint16(26, name.length, true);
      const c = new Uint8Array(46), cv = new DataView(c.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x800, true); cv.setUint16(14, 33, true);
      cv.setUint32(16, sum, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true);
      local.push(h, name, data); central.push(c, name); offset += h.length + name.length + data.length; size += c.length + name.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
    return new Blob([...local, ...central, end], { type: 'application/zip' });
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  document.querySelector('#save-package').onclick = async () => {
    try {
      const result = await snapshot();
      download(zip([{ path: '简单抽奖策划案.html', data: bytes(result.html) }, { path: 'planning.json', data: bytes(JSON.stringify(result.planning, null, 2)) }, ...result.files]), '简单抽奖策划案_完整资料包.zip');
      window.lotteryEditor.markSaved(); notice('已下载完整资料包，包含当前正文、导入数据及附件。');
    } catch (e) { notice('导出失败：' + e.message); }
  };
  document.querySelector('#save-html').onclick = async () => {
    try { const result = await snapshot(); download(new Blob([result.html], { type: 'text/html;charset=utf-8' }), '简单抽奖策划案.html'); window.lotteryEditor.markSaved(); notice('已下载 HTML；需要配套导入数据时请下载完整资料包。'); }
    catch (e) { notice('导出失败：' + e.message); }
  };
  window.planningExport = { snapshot };
})();
