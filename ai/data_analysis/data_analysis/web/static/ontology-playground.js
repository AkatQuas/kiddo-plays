/* Live ontology playground. Renders registered object types, links and actions.
   No synthetic nodes. Broken links stay in the warning list, not on the canvas. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CARD_W = 248;
  const CARD_H = 132;
  const GAP_X = 108;
  const GAP_Y = 28;
  const PAD = 28;
  const CARDINALITY = {
    ONE_TO_ONE: '一对一',
    ONE_TO_MANY: '一对多',
    MANY_TO_ONE: '多对一',
    MANY_TO_MANY: '多对多'
  };

  function listOf(data, key) {
    if (!data || typeof data !== 'object') return [];
    if (Array.isArray(data[key])) return data[key];
    if (Array.isArray(data)) return data;
    return [];
  }

  async function load(ctx) {
    const api = ctx && ctx.api;
    if (typeof api !== 'function') throw new Error('缺少分析接口');
    const [objects, links, actions, graph] = await Promise.all([
      api('/api/v1/ontology/objects', {method:'GET'}),
      api('/api/v1/ontology/links', {method:'GET'}),
      api('/api/v1/ontology/actions', {method:'GET'}),
      api('/api/v1/ontology/entity_graph', {method:'GET'})
    ]);
    for (const res of [objects, links, actions, graph]) {
      if (res && res.ok === false) throw new Error(res.detail || '本体接口失败');
    }
    return {
      objects: listOf(objects, 'object_types'),
      links: listOf(links, 'link_types'),
      actions: listOf(actions, 'action_types'),
      graph: graph && graph.nodes ? graph : {nodes:[], edges:[], broken_edges:[]}
    };
  }

  function depthOf(nodes, edges) {
    const ids = new Set(nodes.map(n => n.id));
    const depth = {};
    const visiting = new Set();
    function walk(id) {
      if (depth[id] != null) return depth[id];
      if (visiting.has(id)) return 0;
      visiting.add(id);
      const preds = edges.filter(e => e.target === id && ids.has(e.source)).map(e => e.source);
      const value = preds.length ? 1 + Math.max(...preds.map(walk)) : 0;
      visiting.delete(id);
      depth[id] = value;
      return value;
    }
    nodes.forEach(n => walk(n.id));
    return depth;
  }

  function layout(nodes, edges) {
    const depth = depthOf(nodes, edges);
    const columns = new Map();
    nodes.forEach(node => {
      const column = depth[node.id] || 0;
      if (!columns.has(column)) columns.set(column, []);
      columns.get(column).push(node);
    });
    const placed = new Map();
    let width = PAD * 2;
    let height = PAD * 2;
    [...columns.keys()].sort((a, b) => a - b).forEach(column => {
      columns.get(column).forEach((node, row) => {
        const x = PAD + column * (CARD_W + GAP_X);
        const y = PAD + row * (CARD_H + GAP_Y);
        placed.set(node.id, {x, y});
        width = Math.max(width, x + CARD_W + PAD);
        height = Math.max(height, y + CARD_H + PAD);
      });
    });
    return {placed, width, height};
  }

  function edgePath(from, to, same) {
    const x1 = from.x + CARD_W;
    const y1 = from.y + CARD_H / 2;
    const x2 = to.x;
    const y2 = to.y + CARD_H / 2;
    if (from === to || (from.x === to.x && from.y === to.y)) {
      const x = from.x + CARD_W;
      const y = from.y + 28;
      return {d:`M ${x} ${y} C ${x + 64} ${y - 36}, ${x + 64} ${y + 36}, ${x} ${y + 18}`, labelX:x + 52, labelY:y};
    }
    if (same || to.x <= from.x) {
      const midY = Math.max(from.y, to.y) + CARD_H + 18;
      return {d:`M ${x1} ${y1} C ${x1 + 36} ${midY}, ${x2 - 36} ${midY}, ${x2} ${y2}`, labelX:(x1 + x2) / 2, labelY:midY};
    }
    const midX = (x1 + x2) / 2;
    return {d:`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`, labelX:midX, labelY:(y1 + y2) / 2 - 8};
  }

  function card(node, object, actions, on) {
    const props = (object && object.properties) || [];
    const shown = props.slice(0, 3).map(p => esc(p.name)).join(' · ');
    const more = props.length > 3 ? ` +${props.length - 3}` : '';
    return `<button type="button" class="onto-card${on ? ' is-on' : ''}" data-node="${esc(node.id)}" style="left:${node.x}px;top:${node.y}px" aria-pressed="${on ? 'true' : 'false'}">
      <span>${esc(object && object.display_name || node.display_name || node.id)}</span>
      <small>${esc(node.id)}</small>
      <em>${esc(node.backed_by_table || (object && object.backed_by_table) || '未绑定表')}</em>
      <b>${props.length ? shown + more : '无属性'} · ${actions.length} 个动作</b>
    </button>`;
  }

  function inspector(state) {
    if (state.edge) {
      const link = state.links.find(l => l.name === state.edge.id) || state.edge;
      const bits = [
        ['关系', link.display_name || link.name || link.id],
        ['标识', link.name || link.id],
        ['从', link.source_object_type || link.source],
        ['到', link.target_object_type || link.target],
        ['基数', CARDINALITY[link.cardinality] || link.cardinality || '未声明'],
        ['源键', link.source_join_key],
        ['目标键', link.target_join_key]
      ];
      if (link.junction_table) bits.push(['关联表', link.junction_table], ['关联源键', link.junction_source_key], ['关联目标键', link.junction_target_key]);
      if (link.description) bits.push(['说明', link.description]);
      return `<h3>关系</h3><dl>${bits.filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    }
    const node = state.node;
    if (!node) return '<h3>本体图</h3><p>选择对象或关系。图只显示已注册且两端都存在的关系。</p>';
    const object = state.objects.find(o => o.name === node.id) || {};
    const actions = state.actions.filter(a => a.target_object_type === node.id);
    const links = state.links.filter(l => l.source_object_type === node.id || l.target_object_type === node.id);
    const props = object.properties || [];
    return `<h3>${esc(object.display_name || node.display_name || node.id)}</h3>
      <p>${esc(object.description || '没有说明')}</p>
      <dl>
        <div><dt>标识</dt><dd>${esc(node.id)}</dd></div>
        <div><dt>底表</dt><dd>${esc(object.backed_by_table || node.backed_by_table || '—')}</dd></div>
        <div><dt>主键</dt><dd>${esc(object.primary_key || node.primary_key || '—')}</dd></div>
        <div><dt>标题属性</dt><dd>${esc(object.title_property || '—')}</dd></div>
      </dl>
      <h4>属性</h4>
      ${props.length ? `<ul>${props.map(p => `<li><b>${esc(p.name)}</b> ${esc(p.data_type)}${p.is_primary_key ? ' · 主键' : ''}${p.is_title ? ' · 标题' : ''}</li>`).join('')}</ul>` : '<p>未登记属性。</p>'}
      <h4>关系</h4>
      ${links.length ? `<ul>${links.map(l => `<li>${esc(l.display_name || l.name)} · ${esc(CARDINALITY[l.cardinality] || l.cardinality)} · ${esc(l.source_object_type)} → ${esc(l.target_object_type)}</li>`).join('')}</ul>` : '<p>没有完整关系。</p>'}
      <h4>动作</h4>
      ${actions.length ? `<ul>${actions.map(a => `<li><b>${esc(a.display_name || a.name)}</b> ${esc(a.handler_type)}${a.description ? ' · ' + esc(a.description) : ''}</li>`).join('')}</ul>` : '<p>没有挂在这个对象上的动作。</p>'}`;
  }

  function render(root, state) {
    const stage = root.querySelector('[data-stage]');
    const aside = root.querySelector('[data-inspector]');
    const broken = root.querySelector('[data-broken]');
    const status = root.querySelector('[data-status]');
    const query = (root.querySelector('input').value || '').trim().toLowerCase();
    const objects = state.objects;
    const nodes = (state.graph.nodes || []).filter(node => {
      if (!query) return true;
      const object = objects.find(o => o.name === node.id);
      const blob = [node.id, node.display_name, node.backed_by_table, ...(object && object.properties || []).map(p => p.name)].join(' ').toLowerCase();
      return blob.includes(query);
    });
    const visible = new Set(nodes.map(n => n.id));
    const edges = (state.graph.edges || []).filter(e => visible.has(e.source) && visible.has(e.target));
    const {placed, width, height} = layout(nodes, edges);
    const positioned = nodes.map(node => ({...node, ...placed.get(node.id)}));
    const byId = new Map(positioned.map(node => [node.id, node]));
    const paths = edges.map(edge => {
      const from = byId.get(edge.source);
      const to = byId.get(edge.target);
      const path = edgePath(from, to, from.x === to.x);
      const on = state.edge && state.edge.id === edge.id;
      const label = CARDINALITY[edge.cardinality] || edge.cardinality || edge.id;
      return `<path data-edge="${esc(edge.id)}" d="${path.d}" class="${on ? 'is-on' : ''}"></path><text data-edge="${esc(edge.id)}" x="${path.labelX}" y="${path.labelY}">${esc(label)}</text>`;
    }).join('');
    stage.style.width = width + 'px';
    stage.style.height = Math.max(height, 280) + 'px';
    stage.innerHTML = `<svg viewBox="0 0 ${width} ${Math.max(height, 280)}" width="${width}" height="${Math.max(height, 280)}" role="img" aria-label="本体关系图">${paths}</svg>` +
      positioned.map(node => card(node, objects.find(o => o.name === node.id), state.actions.filter(a => a.target_object_type === node.id), state.node && state.node.id === node.id)).join('');
    if (!nodes.length) {
      stage.innerHTML = '<div class="onto-empty"><h3>还没有可显示的业务对象</h3><p>到「对象与关系」登记对象和关系后，刷新这张图。断掉的关系不会被画成假节点。</p></div>';
    }
    aside.innerHTML = inspector(state);
    const brokenEdges = state.graph.broken_edges || [];
    broken.hidden = !brokenEdges.length;
    broken.innerHTML = brokenEdges.length ? `<h3>未画出的关系</h3><ul>${brokenEdges.map(e => `<li>${esc(e.id)}：${esc(e.source)} → ${esc(e.target)}，有一端尚未注册。</li>`).join('')}</ul>` : '';
    status.textContent = `${(state.graph.nodes || []).length} 个对象 · ${edges.length} 条可见关系` + (query ? ` · 筛选「${query}」` : '');
    stage.querySelectorAll('[data-node]').forEach(button => button.addEventListener('click', () => {
      state.node = (state.graph.nodes || []).find(n => n.id === button.dataset.node) || null;
      state.edge = null;
      render(root, state);
    }));
    stage.querySelectorAll('[data-edge]').forEach(el => el.addEventListener('click', () => {
      state.edge = (state.graph.edges || []).find(e => e.id === el.dataset.edge) || null;
      state.node = null;
      render(root, state);
    }));
  }

  async function refresh(root, ctx, state) {
    const status = root.querySelector('[data-status]');
    status.textContent = '正在读取已注册本体…';
    try {
      const data = await load(ctx);
      state.objects = data.objects;
      state.links = data.links;
      state.actions = data.actions;
      state.graph = data.graph;
      if (state.node && !(data.graph.nodes || []).some(n => n.id === state.node.id)) state.node = null;
      render(root, state);
    } catch (err) {
      status.textContent = err.message || '本体图加载失败';
    }
  }

  window.OntologyPlayground = {mount(host, ctx) {
    const state = {objects:[], links:[], actions:[], graph:{nodes:[], edges:[], broken_edges:[]}, node:null, edge:null};
    host.innerHTML = `<div class="onto-play">
      <div class="onto-play-bar"><label>搜索对象<input type="search" placeholder="名称、底表或属性" aria-label="搜索本体对象"></label><button type="button" data-refresh>刷新本体</button><p data-status>正在读取已注册本体…</p></div>
      <div class="onto-play-body"><div class="onto-play-stage" data-stage></div><aside class="onto-play-inspector" data-inspector aria-live="polite"></aside></div>
      <section class="onto-play-broken" data-broken hidden></section>
    </div>`;
    const root = host.querySelector('.onto-play');
    root.querySelector('input').addEventListener('input', () => render(root, state));
    root.querySelector('[data-refresh]').addEventListener('click', () => refresh(root, ctx, state));
    refresh(root, ctx, state);
  }};
})();
