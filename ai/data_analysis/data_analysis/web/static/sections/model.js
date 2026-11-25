/* 看板「模型」段。ctx.api(path, { method, body })，失败信息在 error.detail 或 message。 */
(function () {
  const OUTCOMES = { SUCCESS: '成功', FAILED: '失败', SIMULATED: '已模拟' };

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function pretty(data) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (err) {
      return String(data);
    }
  }

  function formatDetail(detail) {
    if (detail == null || detail === '') return '请求失败';
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return detail.map(formatDetail).join('\n');
    if (typeof detail === 'object') {
      if (detail.msg) {
        const loc = Array.isArray(detail.loc)
          ? detail.loc.filter(function (part) { return part !== 'body'; }).join('.')
          : '';
        return loc ? loc + ': ' + detail.msg : String(detail.msg);
      }
      if (detail.detail != null && detail.detail !== detail) return formatDetail(detail.detail);
      if (typeof detail.message === 'string' && detail.message) return detail.message;
      return pretty(detail);
    }
    return String(detail);
  }

  function extractDetail(err) {
    if (err == null) return '请求失败';
    if (typeof err === 'string') return err;
    if (err.detail != null) return formatDetail(err.detail);
    const body = err.body || err.data || err.payload
      || (err.response && (err.response.data || err.response.body));
    if (body && typeof body === 'object' && body.detail != null) return formatDetail(body.detail);
    if (typeof err.message === 'string' && err.message) return err.message;
    return '请求失败';
  }

  function outcomeStatus(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (typeof payload.status === 'string' && Object.prototype.hasOwnProperty.call(OUTCOMES, payload.status)) {
      return payload.status;
    }
    const nested = payload.execution_result;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      if (typeof nested.status === 'string' && Object.prototype.hasOwnProperty.call(OUTCOMES, nested.status)) {
        return nested.status;
      }
    }
    return null;
  }

  function failureMessage(payload) {
    const sources = [payload && payload.execution_result, payload];
    for (let i = 0; i < sources.length; i += 1) {
      const src = sources[i];
      if (!src || typeof src !== 'object') continue;
      if (typeof src.error === 'string' && src.error) return src.error;
      if (src.status === 'FAILED' && typeof src.message === 'string' && src.message) return src.message;
    }
    return '';
  }

  function isTransportError(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    if (data.status !== 'error' || data.detail == null) return false;
    if (data.execution_result || data.audit_id || data.nodes || data.object_types || data.metrics || data.tables) {
      return false;
    }
    return true;
  }

  async function callApi(ctx, method, path, body) {
    const api = ctx && ctx.api;
    if (typeof api !== 'function') return { ok: false, detail: 'ctx.api 不可用' };
    try {
      const data = await api(path, { method: method, body: body });
      if (data && typeof data === 'object' && data.ok === false && (data.detail != null || data.status === 'error')) {
        return { ok: false, detail: formatDetail(data.detail != null ? data.detail : (data.message || '请求失败')) };
      }
      if (isTransportError(data)) return { ok: false, detail: formatDetail(data.detail) };
      return { ok: true, data: data };
    } catch (err) {
      return { ok: false, detail: extractDetail(err) };
    }
  }

  function notify(ctx, message, tone) {
    if (!ctx || typeof ctx.notify !== 'function') return;
    let text = String(message || '');
    if (tone === 'err' && !/失败|错误|异常/.test(text)) text = '失败：' + text;
    if (text.length > 500) text = text.slice(0, 500);
    ctx.notify(text);
  }

  function sessionId(ctx) {
    try {
      const value = ctx.sessionId();
      return value == null ? '' : String(value);
    } catch (err) {
      return '';
    }
  }

  function withQuery(path, params) {
    const url = new URL(path, 'http://localhost');
    Object.keys(params || {}).forEach(function (key) {
      const value = params[key];
      if (value != null && value !== '') url.searchParams.set(key, String(value));
    });
    return url.pathname + url.search;
  }

  function val(form, name) {
    const field = form.querySelector('[name="' + name + '"]');
    return field ? String(field.value || '') : '';
  }

  function setDefault(form, name, value) {
    const field = form.querySelector('[name="' + name + '"]');
    if (field && !field.value) field.value = value;
  }

  function checked(form, name) {
    const field = form.querySelector('[name="' + name + '"]');
    return !!(field && field.checked);
  }

  function parseList(text) {
    return String(text || '').split(/[,，]/).map(function (part) { return part.trim(); }).filter(Boolean);
  }

  function positiveInt(text, fallback, label) {
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return { ok: true, value: fallback };
    if (!/^\d+$/.test(raw)) return { ok: false, detail: label + '必须是正整数' };
    const number = Number(raw);
    if (!Number.isInteger(number) || number < 1) return { ok: false, detail: label + '必须是正整数' };
    return { ok: true, value: number };
  }

  function parseJson(text, fallback, label) {
    const raw = String(text || '').trim();
    if (!raw) return { ok: true, value: fallback };
    try {
      return { ok: true, value: JSON.parse(raw) };
    } catch (err) {
      return { ok: false, detail: label + '不是合法 JSON' };
    }
  }

  function requireText(pairs) {
    for (let i = 0; i < pairs.length; i += 1) {
      if (!String(pairs[i][1] || '').trim()) return pairs[i][0] + '不能为空';
    }
    return '';
  }

  function coerceId(raw) {
    const text = String(raw).trim();
    if (/^-?\d+$/.test(text)) return Number(text);
    return text;
  }

  function buildProperties(text, primaryKey) {
    const props = [];
    parseList(text).forEach(function (item) {
      const parts = item.split(':');
      const name = (parts[0] || '').trim();
      const dataType = (parts[1] || 'string').trim() || 'string';
      if (!name) return;
      props.push({
        name: name,
        data_type: dataType,
        is_primary_key: name === primaryKey,
        description: '',
      });
    });
    if (primaryKey && !props.some(function (prop) { return prop.name === primaryKey; })) {
      props.unshift({ name: primaryKey, data_type: 'string', is_primary_key: true, description: '' });
    }
    return props;
  }

  function cell(value) {
    if (value == null) return '';
    if (typeof value === 'object') return esc(JSON.stringify(value));
    return esc(String(value));
  }

  function table(columns, rows, emptyText) {
    if (!rows || !rows.length) return '<div class="sec-model-empty">' + esc(emptyText || '没有记录') + '</div>';
    const head = columns.map(function (col) { return '<th>' + esc(col.label) + '</th>'; }).join('');
    const body = rows.map(function (row) {
      const cells = columns.map(function (col) {
        const value = typeof col.value === 'function' ? col.value(row) : row[col.key];
        return '<td>' + cell(value) + '</td>';
      }).join('');
      return '<tr>' + cells + '</tr>';
    }).join('');
    return '<div class="sec-model-table-wrap"><table class="sec-model-table"><thead><tr>' + head
      + '</tr></thead><tbody>' + body + '</tbody></table></div>';
  }

  function recordsTable(rows, emptyText) {
    if (!rows || !rows.length) return '<div class="sec-model-empty">' + esc(emptyText || '没有记录') + '</div>';
    const keys = [];
    rows.forEach(function (row) {
      if (!row || typeof row !== 'object') return;
      Object.keys(row).forEach(function (key) {
        if (keys.indexOf(key) === -1) keys.push(key);
      });
    });
    const columns = keys.slice(0, 8).map(function (key) { return { key: key, label: key }; });
    return table(columns, rows, emptyText);
  }

  function banner(status) {
    const label = OUTCOMES[status] || status;
    const kind = String(status || '').toLowerCase();
    return '<div class="sec-model-banner sec-model-banner-' + esc(kind) + '" data-outcome="' + esc(status) + '">'
      + esc(label) + '</div>';
  }

  function rawBlock(data) {
    return '<details class="sec-model-raw"><summary>原始响应</summary><pre class="sec-model-json">'
      + esc(pretty(data)) + '</pre></details>';
  }

  function failBlock(detail) {
    return '<div class="sec-model-fail" role="alert" data-state="fail"><div class="sec-model-fail-title">失败</div>'
      + '<pre class="sec-model-detail">' + esc(detail) + '</pre></div>';
  }

  function renderResult(host, res, view) {
    if (!res.ok) {
      host.innerHTML = failBlock(res.detail || '请求失败');
      return;
    }
    const status = outcomeStatus(res.data);
    let html = '';
    if (status) html += banner(status);
    if (status === 'FAILED') {
      const message = failureMessage(res.data);
      if (message) html += '<pre class="sec-model-detail">' + esc(message) + '</pre>';
    }
    html += view ? view(res.data) : '';
    html += rawBlock(res.data);
    host.innerHTML = html;
  }

  function finish(ctx, host, res, view, okText) {
    renderResult(host, res, view);
    if (!res.ok) {
      notify(ctx, res.detail || '请求失败', 'err');
      return;
    }
    const status = outcomeStatus(res.data);
    if (status === 'FAILED') {
      const message = failureMessage(res.data);
      notify(ctx, message ? '失败：' + message : '失败', 'err');
      return;
    }
    if (status && OUTCOMES[status]) {
      notify(ctx, OUTCOMES[status], status === 'FAILED' ? 'err' : 'ok');
      return;
    }
    notify(ctx, okText || '已完成', 'ok');
  }

  let markerSeq = 0;

  function nodeIsCurrent(node, currentId) {
    if (!node) return false;
    if (node.current === true || node.is_current === true) return true;
    const key = String(currentId || '').trim();
    if (!key) return false;
    return node.id === key || node.label === key;
  }

  function graphMarkup(graph, title, currentId) {
    if (window.RelationshipView) return window.RelationshipView.markup(graph, title, currentId);
    const sourceNodes = (graph && graph.nodes) || [];
    const edges = ((graph && graph.edges) || []).map(function (edge) {
      return {
        source: edge.source,
        target: edge.target,
        id: edge.id || '',
        cardinality: edge.cardinality || '',
        broken: false,
      };
    });
    const broken = ((graph && graph.broken_edges) || []).map(function (edge) {
      return {
        source: edge.source,
        target: edge.target,
        id: edge.id || '',
        cardinality: edge.cardinality || '',
        broken: true,
      };
    });
    const nodes = sourceNodes.map(function (node) {
      return {
        id: node.id || node.name,
        label: node.display_name || node.name || node.id,
        current: node.current === true || node.is_current === true,
      };
    });
    broken.forEach(function (edge) {
      [edge.source, edge.target].forEach(function (id) {
        if (!id || nodes.some(function (node) { return node.id === id; })) return;
        nodes.push({ id: id, label: id, missing: true });
      });
    });
    if (!nodes.length) {
      return '<div class="sec-model-empty">' + esc(title) + '暂无节点</div>';
    }
    const allEdges = edges.concat(broken);
    const laid = layoutNodes(nodes, allEdges);
    markerSeq += 1;
    const markerId = 'sec-model-arrow-' + markerSeq;
    const lines = allEdges.map(function (edge) {
      const from = laid.pos[edge.source];
      const to = laid.pos[edge.target];
      if (!from || !to || (from.x === to.x && from.y === to.y)) return '';
      const clipped = clipEnds(from, to);
      const marker = edge.broken ? markerId + '-broken' : markerId;
      const dash = edge.broken ? ' stroke-dasharray="3 4" stroke-opacity="0.38"' : ' stroke-opacity="0.78"';
      const midX = (clipped.x1 + clipped.x2) / 2;
      const midY = (clipped.y1 + clipped.y2) / 2 - 7;
      return '<line x1="' + clipped.x1 + '" y1="' + clipped.y1 + '" x2="' + clipped.x2 + '" y2="' + clipped.y2
        + '" stroke="#f3efe6" stroke-width="0.7"' + dash + ' marker-end="url(#' + marker + ')"/>'
        + '<text x="' + midX + '" y="' + midY + '" text-anchor="middle" font-size="10" fill="#a39b8e">'
        + esc(edge.id) + '</text>';
    }).join('');
    const boxes = nodes.map(function (node) {
      const point = laid.pos[node.id];
      const current = nodeIsCurrent(node, currentId);
      const stroke = current ? '#c6a15b' : '#f3efe6';
      const opacity = current ? '1' : (node.missing ? '0.32' : '0.55');
      const width = current ? '1.15' : '0.6';
      const text = current ? '#c6a15b' : (node.missing ? '#a39b8e' : '#f4f0e6');
      const dash = node.missing && !current ? ' stroke-dasharray="3 3"' : '';
      const cls = 'sec-model-node' + (current ? ' sec-model-node-current' : '')
        + (node.missing ? ' sec-model-node-missing' : '');
      return '<g class="' + cls + '"><rect x="' + (point.x - 52) + '" y="' + (point.y - 14)
        + '" width="104" height="28" rx="0" fill="#161410" stroke="' + stroke + '" stroke-opacity="' + opacity
        + '" stroke-width="' + width + '"' + dash + '/>'
        + '<text x="' + point.x + '" y="' + (point.y + 4) + '" text-anchor="middle" font-size="12" fill="' + text + '">'
        + esc(shortLabel(node.label)) + '</text></g>';
    }).join('');
    const nodeList = nodes.map(function (node) {
      const current = nodeIsCurrent(node, currentId);
      return '<li class="' + (current ? 'sec-model-node-current' : '') + '"><span class="sec-model-node-name">'
        + esc(node.label) + '</span> <span class="sec-model-muted">' + esc(node.id) + '</span>'
        + (node.missing ? ' <span class="sec-model-missing">端点未注册</span>' : '')
        + (current ? ' <span class="sec-model-current-mark">当前</span>' : '')
        + '</li>';
    }).join('');
    const edgeList = allEdges.map(function (edge) {
      const note = edge.broken ? '端点未注册' : (edge.cardinality || '');
      return '<li>' + esc(edge.source) + ' → ' + esc(edge.target)
        + ' <span class="sec-model-muted">' + esc([edge.id, note].filter(Boolean).join(' · ')) + '</span></li>';
    }).join('');
    const summary = nodes.length + ' 个节点 · ' + edges.length + ' 条边'
      + (broken.length ? ' · ' + broken.length + ' 条断边' : '');
    return '<div class="sec-model-graph-block"><div class="sec-model-block-title">' + esc(title) + '</div>'
      + '<div class="sec-model-muted">' + esc(summary) + '</div>'
      + '<svg class="sec-model-graph" viewBox="0 0 ' + laid.width + ' ' + laid.height + '" width="100%" height="'
      + laid.height + '" role="img" aria-label="' + esc(title) + '">'
      + '<defs><marker id="' + markerId + '" markerWidth="7" markerHeight="7" refX="6.2" refY="2.6" orient="auto">'
      + '<path d="M0,0 L7,2.6 L0,5.2 Z" fill="#f3efe6" fill-opacity="0.78"/></marker>'
      + '<marker id="' + markerId + '-broken" markerWidth="7" markerHeight="7" refX="6.2" refY="2.6" orient="auto">'
      + '<path d="M0,0 L7,2.6 L0,5.2 Z" fill="#f3efe6" fill-opacity="0.38"/></marker></defs>'
      + lines + boxes + '</svg>'
      + '<div class="sec-model-graph-lists"><div><div class="sec-model-kicker">节点</div><ul class="sec-model-node-list">'
      + nodeList + '</ul></div><div><div class="sec-model-kicker">边</div><ul class="sec-model-edge-list">'
      + (edgeList || '<li class="sec-model-muted">没有边</li>') + '</ul></div></div></div>';
  }

  function clipEnds(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const tx = dx === 0 ? Infinity : 54 / Math.abs(ux);
    const ty = dy === 0 ? Infinity : 16 / Math.abs(uy);
    const pad = Math.max(0, Math.min(tx, ty, len / 2 - 1));
    return {
      x1: round(from.x + ux * pad),
      y1: round(from.y + uy * pad),
      x2: round(to.x - ux * pad),
      y2: round(to.y - uy * pad),
    };
  }

  function round(number) {
    return Math.round(number * 10) / 10;
  }

  function shortLabel(label) {
    const text = String(label || '');
    return text.length > 8 ? text.slice(0, 7) + '…' : text;
  }

  function layoutNodes(nodes, edges) {
    const col = {};
    const adj = {};
    nodes.forEach(function (node) {
      col[node.id] = 0;
      adj[node.id] = [];
    });
    edges.forEach(function (edge) {
      if (adj[edge.source] && col[edge.target] != null && edge.source !== edge.target) {
        adj[edge.source].push(edge.target);
      }
    });
    for (let pass = 0; pass < nodes.length; pass += 1) {
      edges.forEach(function (edge) {
        if (col[edge.source] == null || col[edge.target] == null || edge.source === edge.target) return;
        if (col[edge.target] < col[edge.source] + 1) col[edge.target] = col[edge.source] + 1;
      });
    }
    const groups = {};
    nodes.forEach(function (node) {
      const index = col[node.id] || 0;
      if (!groups[index]) groups[index] = [];
      groups[index].push(node.id);
    });
    const columns = Object.keys(groups).map(Number).sort(function (a, b) { return a - b; });
    const pos = {};
    const colW = 228;
    const rowH = 58;
    let maxRows = 1;
    columns.forEach(function (column, columnIndex) {
      maxRows = Math.max(maxRows, groups[column].length);
      groups[column].forEach(function (id, rowIndex) {
        pos[id] = { x: 78 + columnIndex * colW, y: 32 + rowIndex * rowH };
      });
    });
    return {
      pos: pos,
      width: Math.max(220, 36 + Math.max(columns.length, 1) * colW),
      height: Math.max(88, 20 + maxRows * rowH),
    };
  }

  function objectTable(rows) {
    return table([
      { label: '名称', value: function (row) { return row.display_name || row.name; } },
      { key: 'name', label: '标识' },
      { key: 'primary_key', label: '主键' },
      { key: 'backed_by_table', label: '底表' },
      { label: '属性', value: function (row) {
        return (row.properties || []).map(function (prop) { return prop.name; }).join(', ');
      } },
    ], rows, '暂无对象');
  }

  function linkTable(rows) {
    return table([
      { key: 'name', label: '名称' },
      { key: 'source_object_type', label: '源' },
      { key: 'target_object_type', label: '目标' },
      { key: 'cardinality', label: '基数' },
      { label: '连接键', value: function (row) { return (row.source_join_key || '') + ' = ' + (row.target_join_key || ''); } },
    ], rows, '暂无关系');
  }

  function actionTable(rows) {
    return table([
      { key: 'name', label: '名称' },
      { key: 'target_object_type', label: '对象' },
      { key: 'handler_type', label: '处理器' },
      { label: '参数', value: function (row) {
        return (row.parameters || []).map(function (param) { return param.name; }).join(', ');
      } },
    ], rows, '暂无动作');
  }

  function metricTable(rows) {
    return table([
      { key: 'name', label: '名称' },
      { key: 'formula', label: '公式' },
      { key: 'table_name', label: '表' },
      { key: 'aggregation_type', label: '聚合' },
    ], rows, '暂无指标');
  }

  function catalogTable(rows) {
    return table([
      { key: 'dataset_name', label: '数据集' },
      { key: 'row_count', label: '行' },
      { key: 'column_count', label: '列' },
      { label: '标签', value: function (row) { return (row.tags || []).join(', '); } },
      { key: 'description', label: '描述' },
    ], rows, '目录为空');
  }

  function schemaView(data) {
    return '<div class="sec-model-stack"><div><div class="sec-model-kicker">对象</div>'
      + objectTable(data.object_types || []) + '</div><div><div class="sec-model-kicker">关系</div>'
      + linkTable((data.link_types || []).map(function (link) {
        return {
          name: link.name,
          source_object_type: link.source,
          target_object_type: link.target,
          cardinality: link.cardinality,
          source_join_key: '',
          target_join_key: '',
        };
      })) + '</div></div>';
  }

  function instanceView(data) {
    const matched = data.matched_count != null ? data.matched_count : '—';
    const page = data.total_instances != null ? data.total_instances : (data.instances || []).length;
    return '<div class="sec-model-muted">匹配 ' + esc(matched) + ' 条，本页 ' + esc(page) + ' 条</div>'
      + recordsTable(data.instances || [], '没有实例');
  }

  function traverseView(data) {
    const path = (data.path || []).join(' → ');
    const truncated = data.truncated ? '已截断' : '未截断';
    const hops = table([
      { key: 'link_name', label: '关系' },
      { key: 'source_object_type', label: '源' },
      { key: 'target_object_type', label: '目标' },
      { key: 'cardinality', label: '基数' },
      { key: 'count', label: '数量' },
      { label: '截断', value: function (row) { return row.truncated ? '是' : '否'; } },
    ], data.hop_details || [], '没有跳');
    const warnings = (data.cardinality_warnings || []).map(function (item) {
      return '<div class="sec-model-warn">' + esc(item) + '</div>';
    }).join('');
    return '<div class="sec-model-muted">路径 ' + esc(path || '—') + ' · 跳数 ' + esc(data.hops)
      + ' · ' + esc(truncated) + '</div>' + warnings + hops
      + '<div class="sec-model-kicker">关联实例</div>'
      + recordsTable(data.linked_instances || [], '没有关联实例');
  }

  function auditTable(rows) {
    return table([
      { key: 'executed_at', label: '时间' },
      { key: 'action_name', label: '动作' },
      { key: 'target_instance_id', label: '实例' },
      { key: 'status', label: '状态' },
    ], rows, '暂无审计');
  }

  function metricQueryView(data) {
    const versions = data.metric_versions
      ? Object.keys(data.metric_versions).map(function (name) {
        return name + '=' + data.metric_versions[name];
      }).join('，')
      : '';
    return '<div class="sec-model-kicker">编译 SQL</div><pre class="sec-model-json">' + esc(data.compiled_sql || '') + '</pre>'
      + (versions ? '<div class="sec-model-muted">版本 ' + esc(versions) + '</div>' : '')
      + recordsTable(data.data || [], '查询没有返回行');
  }

  const CSS = [
    '.sec-model-root{--sec-model-bg:#0e0d0b;--sec-model-lift:#161410;--sec-model-line:rgba(243,239,230,0.12);--sec-model-ink:#f4f0e6;--sec-model-muted:#a39b8e;--sec-model-gold:#c6a15b;background:#0e0d0b;color:#f4f0e6;color-scheme:dark;font:14px/1.55 Outfit,"Noto Sans SC","PingFang SC","Microsoft YaHei",sans-serif;margin:-16px -18px -24px;padding:36px 40px 48px;min-height:calc(100vh - 80px);}',
    '.sec-model-root *,.sec-model-root *::before,.sec-model-root *::after{box-sizing:border-box;}',
    '.sec-model-root button,.sec-model-root input,.sec-model-root select,.sec-model-root textarea{font:inherit;border-radius:0;}',
    '.sec-model-root [hidden]{display:none !important;}',
    '.sec-model-root ::selection{background:rgba(198,161,91,0.28);color:#f4f0e6;}',
    '.sec-model-head{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;padding:0 0 22px;border-bottom:1px solid rgba(243,239,230,0.12);}',
    '.sec-model-root .sec-model-title{margin:0 !important;font-family:"Cormorant Garamond","Noto Serif SC",serif !important;font-size:46px !important;font-weight:500 !important;line-height:0.9;letter-spacing:0.14em;color:#f4f0e6;}',
    '.sec-model-title::after{content:"";display:block;width:36px;height:1px;margin-top:16px;background:#c6a15b;}',
    '.sec-model-session{font-size:12px;letter-spacing:0.12em;color:#a39b8e;}',
    '.sec-model-sid{font-family:Outfit,"Noto Sans SC",sans-serif;color:#f4f0e6;font-size:12px;}',
    '.sec-model-tabs{display:flex;gap:28px;padding:0;margin:0;border-bottom:1px solid rgba(243,239,230,0.12);}',
    '.sec-model-root .sec-model-tab{appearance:none;border:0;border-bottom:1px solid transparent;background:transparent;color:#a39b8e;padding:16px 0 14px;margin-bottom:-1px;cursor:pointer;letter-spacing:0.12em;}',
    '.sec-model-root .sec-model-tab:hover{color:#f4f0e6;}',
    '.sec-model-root .sec-model-tab-active{background:transparent;color:#f4f0e6;font-weight:500;border-bottom-color:#c6a15b;}',
    '.sec-model-pane{padding:28px 0 0;}',
    '.sec-model-split{display:grid;grid-template-columns:minmax(260px,340px) minmax(0,1fr);gap:28px;align-items:start;}',
    '.sec-model-form,.sec-model-result{border:1px solid rgba(243,239,230,0.12);background:#161410;padding:22px 22px 18px;min-width:0;border-radius:0;}',
    '.sec-model-result{background:#0e0d0b;min-height:280px;overflow:auto;}',
    '.sec-model-label{display:flex;flex-direction:column;gap:6px;font-size:12px;letter-spacing:0.08em;color:#a39b8e;margin-bottom:14px;}',
    '.sec-model-root .sec-model-input,.sec-model-root .sec-model-area{width:100%;border:1px solid rgba(243,239,230,0.12);background:#0e0d0b;border-radius:0;padding:8px 10px;font-size:14px;color:#f4f0e6;}',
    '.sec-model-input::placeholder,.sec-model-area::placeholder{color:#a39b8e;opacity:0.7;}',
    '.sec-model-area{min-height:72px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;letter-spacing:0;}',
    '.sec-model-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;}',
    '.sec-model-check{display:flex;align-items:center;gap:8px;font-size:13px;letter-spacing:0.04em;color:#f4f0e6;margin:0 0 14px;}',
    '.sec-model-check input{accent-color:#c6a15b;}',
    '.sec-model-hint{margin:0 0 16px;font-size:13px;line-height:1.6;color:#a39b8e;letter-spacing:0;}',
    '.sec-model-actions{display:flex;gap:12px;flex-wrap:wrap;}',
    '.sec-model-root .sec-model-submit,.sec-model-root .sec-model-ghost{border-radius:0;padding:9px 16px;cursor:pointer;letter-spacing:0.14em;background:transparent;}',
    '.sec-model-root .sec-model-submit{border:1px solid #c6a15b;color:#c6a15b;}',
    '.sec-model-root .sec-model-submit:hover{background:#c6a15b;color:#0e0d0b;}',
    '.sec-model-root .sec-model-ghost{border:1px solid rgba(243,239,230,0.12);color:#f4f0e6;}',
    '.sec-model-root .sec-model-ghost:hover{border-color:#c6a15b;color:#c6a15b;}',
    '.sec-model-root .sec-model-submit:disabled,.sec-model-root .sec-model-ghost:disabled{opacity:.4;cursor:default;background:transparent;color:#c6a15b;}',
    '.sec-model-root .sec-model-ghost:disabled{color:#a39b8e;}',
    '.sec-model-table-wrap{overflow:auto;max-height:320px;}',
    '.sec-model-table{width:100%;border-collapse:collapse;font-size:13px;}',
    '.sec-model-root .sec-model-table th,.sec-model-root .sec-model-table td{text-align:left;padding:8px 10px;border-bottom:1px solid rgba(243,239,230,0.12) !important;vertical-align:top;white-space:nowrap;color:#f4f0e6 !important;background:transparent !important;}',
    '.sec-model-root .sec-model-table th{color:#a39b8e !important;font-weight:500 !important;letter-spacing:0.08em;font-size:11px;}',
    '.sec-model-json{margin:0;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;max-height:220px;overflow:auto;color:#f4f0e6;background:transparent;}',
    '.sec-model-raw{margin-top:16px;}',
    '.sec-model-raw summary{cursor:pointer;color:#a39b8e;font-size:12px;letter-spacing:0.1em;}',
    '.sec-model-fail{border:1px solid rgba(243,239,230,0.12);background:#161410;color:#f4f0e6;padding:16px 18px;border-radius:0;}',
    '.sec-model-fail-title{font-family:"Cormorant Garamond","Noto Serif SC",serif;font-weight:500;font-size:22px;letter-spacing:0.12em;color:#c6a15b;margin-bottom:6px;}',
    '.sec-model-detail{margin:8px 0 0;white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#f4f0e6;}',
    '.sec-model-banner{display:inline-block;padding:0 0 4px;font-size:12px;font-weight:500;letter-spacing:0.16em;border:0;border-bottom:1px solid rgba(243,239,230,0.12);background:transparent;margin-bottom:14px;border-radius:0;}',
    '.sec-model-banner-success{color:#c6a15b;border-bottom-color:#c6a15b;}',
    '.sec-model-banner-failed{color:#f4f0e6;border-bottom-color:rgba(243,239,230,0.12);}',
    '.sec-model-banner-simulated{color:#a39b8e;border-bottom-color:rgba(243,239,230,0.12);}',
    '.sec-model-empty,.sec-model-muted{color:#a39b8e;font-size:13px;}',
    '.sec-model-empty{padding:8px 0 4px;}',
    '.sec-model-kicker{margin:18px 0 8px;font-weight:500;font-size:12px;letter-spacing:0.16em;color:#a39b8e;}',
    '.sec-model-warn{color:#c6a15b;font-size:13px;margin:8px 0;letter-spacing:0.02em;}',
    '.sec-model-missing{color:#a39b8e;}',
    '.sec-model-current-mark{color:#c6a15b;letter-spacing:0.14em;font-size:11px;}',
    '.sec-model-node-current .sec-model-node-name{color:#c6a15b;}',
    '.sec-model-graph{display:block;background:#0e0d0b;border:1px solid rgba(243,239,230,0.12);border-radius:0;margin:12px 0 4px;}',
    '.sec-model-graph text{font-family:Outfit,"Noto Sans SC",sans-serif;}',
    '.sec-model-graph-lists{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:16px;}',
    '.sec-model-node-list,.sec-model-edge-list{margin:0;padding:0;list-style:none;font-size:13px;}',
    '.sec-model-node-list li,.sec-model-edge-list li{padding:7px 0;border-bottom:1px solid rgba(243,239,230,0.12);}',
    '.sec-model-block-title{font-family:"Cormorant Garamond","Noto Serif SC",serif;font-size:28px;font-weight:500;letter-spacing:0.12em;line-height:1;margin:0 0 8px;color:#f4f0e6;}',
    '.sec-model-graph-block{margin-bottom:8px;}',
    '.sec-model-stack{display:flex;flex-direction:column;gap:18px;}',
    '.sec-model-root :focus-visible{outline:1px solid #c6a15b;outline-offset:2px;}',
    '@media (max-width:760px){.sec-model-root{margin:-16px -18px -24px;padding:28px 20px 36px;}.sec-model-title{font-size:36px;}.sec-model-split,.sec-model-graph-lists,.sec-model-grid{grid-template-columns:1fr;}.sec-model-tabs{gap:18px;}}',
  ].join('');

  function field(name, label, placeholder, extra) {
    return '<label class="sec-model-label" data-ops="' + esc(extra || '') + '">' + esc(label)
      + '<input class="sec-model-input" name="' + esc(name) + '" placeholder="' + esc(placeholder || '') + '" autocomplete="off" spellcheck="false">'
      + '</label>';
  }

  function area(name, label, placeholder, ops) {
    return '<label class="sec-model-label" data-ops="' + esc(ops) + '">' + esc(label)
      + '<textarea class="sec-model-area" name="' + esc(name) + '" placeholder="' + esc(placeholder || '') + '" spellcheck="false"></textarea>'
      + '</label>';
  }

  function selectBox(name, label, options, ops, value) {
    const opts = options.map(function (opt) {
      const selected = opt.value === value ? ' selected' : '';
      return '<option value="' + esc(opt.value) + '"' + selected + '>' + esc(opt.label) + '</option>';
    }).join('');
    return '<label class="sec-model-label" data-ops="' + esc(ops || '') + '">' + esc(label)
      + '<select class="sec-model-input" name="' + esc(name) + '">' + opts + '</select></label>';
  }

  function shell() {
    const objectOps = [
      { value: 'list-objects', label: '刷新对象' },
      { value: 'register-object', label: '注册对象' },
      { value: 'list-links', label: '刷新关系' },
      { value: 'register-link', label: '注册关系' },
      { value: 'list-actions', label: '刷新动作' },
      { value: 'register-action', label: '注册动作' },
      { value: 'query-instances', label: '查询实例' },
      { value: 'execute-action', label: '执行动作' },
      { value: 'list-audit', label: '查看审计' },
      { value: 'schema', label: '查看摘要' },
    ];
    const metricOps = [
      { value: 'list-tables', label: '刷新目录' },
      { value: 'register-table', label: '注册资产' },
      { value: 'lineage', label: '刷新血缘' },
      { value: 'list-metrics', label: '刷新指标' },
      { value: 'register-metric', label: '注册指标' },
      { value: 'query-metrics', label: '查询指标' },
    ];
    return ''
      + '<div class="sec-model-root">'
      + '<style>' + CSS + '</style>'
      + '<div class="sec-model-head"><h2 class="sec-model-title">模型</h2>'
      + '<div class="sec-model-session">会话 <code class="sec-model-sid">—</code></div></div>'
      + '<div class="sec-model-tabs" role="tablist">'
      + '<button type="button" class="sec-model-tab sec-model-tab-active" data-tab="objects" role="tab" aria-selected="true">对象与关系</button>'
      + '<button type="button" class="sec-model-tab" data-tab="playground" role="tab" aria-selected="false">本体图</button>'
      + '<button type="button" class="sec-model-tab" data-tab="traverse" role="tab" aria-selected="false">遍历</button>'
      + '<button type="button" class="sec-model-tab" data-tab="metrics" role="tab" aria-selected="false">指标与血缘</button>'
      + '</div>'
      + '<section class="sec-model-pane" data-pane="objects">'
      + '<button type="button" class="sec-model-ghost" data-action="object-graph">加载业务关系图 ↗</button><div class="sec-model-object-graph"></div>'
      + '<div class="sec-model-split"><form class="sec-model-form" data-form="objects">'
      + selectBox('op', '操作', objectOps, '', 'list-objects')
      + '<div class="sec-model-grid" data-ops="register-object">'
      + field('obj_name', '名称', 'Customer', 'register-object')
      + field('obj_display', '显示名', '客户', 'register-object')
      + field('obj_pk', '主键', 'customer_id', 'register-object')
      + field('obj_table', '底表', 'customers', 'register-object')
      + '</div>'
      + area('obj_props', '属性', 'customer_id:string, name:string', 'register-object')
      + field('obj_desc', '描述', '', 'register-object')
      + '<div class="sec-model-grid" data-ops="register-link">'
      + field('link_name', '关系名', 'customer_orders', 'register-link')
      + selectBox('cardinality', '基数', [
        { value: 'ONE_TO_MANY', label: '一对多' },
        { value: 'MANY_TO_ONE', label: '多对一' },
        { value: 'ONE_TO_ONE', label: '一对一' },
        { value: 'MANY_TO_MANY', label: '多对多' },
      ], 'register-link', 'ONE_TO_MANY')
      + field('link_source', '源对象', 'Customer', 'register-link')
      + field('link_target', '目标对象', 'Order', 'register-link')
      + field('link_source_key', '源连接键', 'customer_id', 'register-link')
      + field('link_target_key', '目标连接键', 'customer_id', 'register-link')
      + '</div>'
      + '<div class="sec-model-junction" data-ops="register-link">'
      + '<p class="sec-model-hint">多对多需要关联表。</p>'
      + '<div class="sec-model-grid">'
      + field('junction_table', '关联表', 'order_items', 'register-link')
      + field('junction_source_key', '关联源键', 'order_id', 'register-link')
      + field('junction_target_key', '关联目标键', 'product_id', 'register-link')
      + '</div></div>'
      + field('action_filter', '按对象过滤', 'Customer', 'list-actions')
      + '<div class="sec-model-grid" data-ops="register-action">'
      + field('action_name', '动作名', 'NotifyCustomer', 'register-action')
      + field('action_target', '目标对象', 'Customer', 'register-action')
      + selectBox('handler_type', '处理器', [
        { value: 'WEBHOOK', label: '回调' },
        { value: 'SQL_MUTATION', label: 'SQL 写入' },
        { value: 'REVERSE_ETL_SYNC', label: '反向同步' },
      ], 'register-action', 'WEBHOOK')
      + '</div>'
      + area('action_params', '参数定义', '[{"name":"note","data_type":"string","required":false}]', 'register-action')
      + area('handler_config', '处理器配置', '{"webhook_url":"http://127.0.0.1:9/hook","platform":"generic"}', 'register-action')
      + '<div class="sec-model-grid" data-ops="query-instances">'
      + field('q_type', '对象类型', 'Customer', 'query-instances')
      + field('q_limit', '条数', '50', 'query-instances')
      + '</div>'
      + field('q_filters', '过滤条件', "status = 'active'", 'query-instances')
      + field('q_props', '属性', 'customer_id, name', 'query-instances')
      + '<div class="sec-model-grid" data-ops="execute-action">'
      + field('exec_name', '动作名', 'NotifyCustomer', 'execute-action')
      + field('exec_id', '实例主键', 'C01', 'execute-action')
      + '</div>'
      + area('exec_params', '参数', '{}', 'execute-action')
      + '<label class="sec-model-check" data-ops="execute-action"><input type="checkbox" name="dry_run"> 仅预览，不写入</label>'
      + field('audit_limit', '条数', '50', 'list-audit')
      + '<button type="submit" class="sec-model-submit">刷新对象</button>'
      + '</form><div class="sec-model-result" data-result="objects"><div class="sec-model-empty">结果会显示在这里</div></div></div></section>'
      + '<section class="sec-model-pane" data-pane="playground" hidden></section>'
      + '<section class="sec-model-pane" data-pane="traverse" hidden>'
      + '<div class="sec-model-split"><form class="sec-model-form" data-form="traverse">'
      + '<p class="sec-model-hint">下钻会提交关系路径和最大跳数。路径留空时按单个关系名走一跳，填写时第一项须与关系名相同。</p>'
      + '<div class="sec-model-grid">'
      + field('source_object_type', '源对象类型', 'Customer', 'traverse')
      + field('source_instance_id', '源实例主键', 'C01', 'traverse')
      + field('link_name', '关系名', 'customer_orders', 'traverse')
      + field('limit', '条数上限', '50', 'traverse')
      + '</div>'
      + field('link_path', '关系路径', 'customer_orders,order_items', 'traverse')
      + field('max_hops', '最大跳数', '4', 'traverse')
      + '<div class="sec-model-actions">'
      + '<button type="submit" class="sec-model-submit" data-action="traverse">下钻</button>'
      + '<button type="button" class="sec-model-ghost" data-action="graph">加载实体图</button>'
      + '</div></form>'
      + '<div class="sec-model-result" data-result="traverse">'
      + '<div class="sec-model-graph-host"><div class="sec-model-empty">实体图尚未加载</div></div>'
      + '<div class="sec-model-traverse-host"></div>'
      + '</div></div></section>'
      + '<section class="sec-model-pane" data-pane="metrics" hidden>'
      + '<div class="sec-model-split"><form class="sec-model-form" data-form="metrics">'
      + selectBox('op', '操作', metricOps, '', 'list-metrics')
      + '<div class="sec-model-grid" data-ops="list-tables">'
      + field('keyword', '关键字', '', 'list-tables')
      + field('tag', '标签', '', 'list-tables')
      + '</div>'
      + '<div class="sec-model-grid" data-ops="register-table">'
      + field('dataset_name', '数据集', 'orders', 'register-table')
      + field('display_name', '显示名', '订单', 'register-table')
      + '</div>'
      + field('table_desc', '描述', '', 'register-table')
      + field('table_tags', '标签', 'mart', 'register-table')
      + '<div class="sec-model-grid" data-ops="register-metric">'
      + field('metric_name', '指标名', 'total_sales', 'register-metric')
      + field('metric_table', '表', 'orders', 'register-metric')
      + field('metric_formula', '公式', 'SUM(sales)', 'register-metric')
      + selectBox('aggregation_type', '聚合', [
        { value: 'CUSTOM', label: '自定义' },
        { value: 'SUM', label: '求和' },
        { value: 'AVG', label: '平均' },
        { value: 'COUNT', label: '计数' },
        { value: 'RATIO', label: '比率' },
        { value: 'CUMULATIVE', label: '累计' },
      ], 'register-metric', 'CUSTOM')
      + '</div>'
      + field('metric_dims', '维度', 'region, channel', 'register-metric')
      + '<div class="sec-model-ratio" data-ops="register-metric">'
      + '<div class="sec-model-grid">'
      + field('numerator_metric', '分子指标', '', 'register-metric')
      + field('denominator_metric', '分母指标', '', 'register-metric')
      + '</div></div>'
      + '<div class="sec-model-grid" data-ops="query-metrics">'
      + field('query_metrics', '指标', 'total_sales', 'query-metrics')
      + field('query_limit', '条数', '100', 'query-metrics')
      + '</div>'
      + field('query_dims', '维度', 'region', 'query-metrics')
      + field('query_filters', '过滤条件', '', 'query-metrics')
      + field('query_order', '排序', '', 'query-metrics')
      + '<button type="submit" class="sec-model-submit">刷新指标</button>'
      + '</form><div class="sec-model-result" data-result="metrics"><div class="sec-model-empty">结果会显示在这里</div></div></div></section>'
      + '</div>';
  }

  function applyOps(form, op) {
    form.querySelectorAll('[data-ops]').forEach(function (node) {
      const raw = (node.getAttribute('data-ops') || '').trim();
      if (!raw) return;
      node.hidden = raw.split(/\s+/).indexOf(op) === -1;
    });
  }

  function syncObjectForm(form) {
    const op = val(form, 'op');
    applyOps(form, op);
    const junction = form.querySelector('.sec-model-junction');
    if (junction && op === 'register-link' && val(form, 'cardinality') !== 'MANY_TO_MANY') junction.hidden = true;
    const button = form.querySelector('.sec-model-submit');
    const labels = {
      'list-objects': '刷新对象',
      'register-object': '注册对象',
      'list-links': '刷新关系',
      'register-link': '注册关系',
      'list-actions': '刷新动作',
      'register-action': '注册动作',
      'query-instances': '查询实例',
      'execute-action': '执行动作',
      'list-audit': '查看审计',
      schema: '查看摘要',
    };
    if (button && !button.disabled) button.textContent = labels[op] || '执行';
  }

  function syncMetricForm(form) {
    const op = val(form, 'op');
    applyOps(form, op);
    const ratio = form.querySelector('.sec-model-ratio');
    if (ratio && op === 'register-metric' && val(form, 'aggregation_type') !== 'RATIO') ratio.hidden = true;
    const button = form.querySelector('.sec-model-submit');
    const labels = {
      'list-tables': '刷新目录',
      'register-table': '注册资产',
      lineage: '刷新血缘',
      'list-metrics': '刷新指标',
      'register-metric': '注册指标',
      'query-metrics': '查询指标',
    };
    if (button && !button.disabled) button.textContent = labels[op] || '执行';
  }

  function paintSession(root, ctx) {
    const node = root.querySelector('.sec-model-sid');
    if (!node) return;
    const id = sessionId(ctx);
    node.textContent = id || '（空）';
  }

  async function withBusy(button, work) {
    if (!button) return work();
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = '请求中';
    try {
      return await work();
    } finally {
      button.disabled = false;
      button.textContent = previous;
    }
  }

  async function runObject(ctx, form, host, button) {
    const op = val(form, 'op');
    const sid = sessionId(ctx);
    let path = '';
    let method = 'GET';
    let body;
    let view = function () { return ''; };
    let okText = '已完成';

    if (op === 'list-objects') {
      path = '/api/v1/ontology/objects';
      view = function (data) { return objectTable(data.object_types || []); };
      okText = '已刷新对象';
    } else if (op === 'register-object') {
      const missing = requireText([
        ['名称', val(form, 'obj_name')],
        ['主键', val(form, 'obj_pk')],
        ['底表', val(form, 'obj_table')],
      ]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      method = 'POST';
      path = '/api/v1/ontology/objects';
      body = {
        name: val(form, 'obj_name').trim(),
        display_name: val(form, 'obj_display').trim() || null,
        description: val(form, 'obj_desc').trim(),
        primary_key: val(form, 'obj_pk').trim(),
        backed_by_table: val(form, 'obj_table').trim(),
        properties: buildProperties(val(form, 'obj_props'), val(form, 'obj_pk').trim()),
      };
      view = function (data) { return objectTable([data]); };
      okText = '已注册对象';
    } else if (op === 'list-links') {
      path = '/api/v1/ontology/links';
      view = function (data) { return linkTable(data.link_types || []); };
      okText = '已刷新关系';
    } else if (op === 'register-link') {
      const cardinality = val(form, 'cardinality');
      const missing = requireText([
        ['关系名', val(form, 'link_name')],
        ['源对象', val(form, 'link_source')],
        ['目标对象', val(form, 'link_target')],
        ['源连接键', val(form, 'link_source_key')],
        ['目标连接键', val(form, 'link_target_key')],
      ]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      if (cardinality === 'MANY_TO_MANY') {
        const junctionMissing = requireText([
          ['关联表', val(form, 'junction_table')],
          ['关联源键', val(form, 'junction_source_key')],
          ['关联目标键', val(form, 'junction_target_key')],
        ]);
        if (junctionMissing) return finish(ctx, host, { ok: false, detail: junctionMissing });
      }
      method = 'POST';
      path = '/api/v1/ontology/links';
      body = {
        name: val(form, 'link_name').trim(),
        source_object_type: val(form, 'link_source').trim(),
        target_object_type: val(form, 'link_target').trim(),
        cardinality: cardinality,
        source_join_key: val(form, 'link_source_key').trim(),
        target_join_key: val(form, 'link_target_key').trim(),
      };
      if (cardinality === 'MANY_TO_MANY') {
        body.junction_table = val(form, 'junction_table').trim();
        body.junction_source_key = val(form, 'junction_source_key').trim();
        body.junction_target_key = val(form, 'junction_target_key').trim();
      }
      view = function (data) { return linkTable([data]); };
      okText = '已注册关系';
    } else if (op === 'list-actions') {
      path = withQuery('/api/v1/ontology/actions', { target_object_type: val(form, 'action_filter').trim() });
      view = function (data) { return actionTable(data.action_types || []); };
      okText = '已刷新动作';
    } else if (op === 'register-action') {
      const missing = requireText([
        ['动作名', val(form, 'action_name')],
        ['目标对象', val(form, 'action_target')],
      ]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      const params = parseJson(val(form, 'action_params'), [], '参数定义');
      if (!params.ok) return finish(ctx, host, params);
      if (!Array.isArray(params.value)) return finish(ctx, host, { ok: false, detail: '参数定义须为 JSON 数组' });
      const config = parseJson(val(form, 'handler_config'), {}, '处理器配置');
      if (!config.ok) return finish(ctx, host, config);
      if (!config.value || typeof config.value !== 'object' || Array.isArray(config.value)) {
        return finish(ctx, host, { ok: false, detail: '处理器配置须为 JSON 对象' });
      }
      method = 'POST';
      path = '/api/v1/ontology/actions';
      body = {
        name: val(form, 'action_name').trim(),
        target_object_type: val(form, 'action_target').trim(),
        handler_type: val(form, 'handler_type'),
        parameters: params.value,
        handler_config: config.value,
      };
      view = function (data) { return actionTable([data]); };
      okText = '已注册动作';
    } else if (op === 'query-instances') {
      const missing = requireText([['对象类型', val(form, 'q_type')]]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      const limit = positiveInt(val(form, 'q_limit'), 50, '条数');
      if (!limit.ok) return finish(ctx, host, limit);
      const properties = parseList(val(form, 'q_props'));
      method = 'POST';
      path = '/api/v1/ontology/instances/query';
      body = {
        session_id: sid,
        object_type: val(form, 'q_type').trim(),
        limit: limit.value,
      };
      const filters = val(form, 'q_filters').trim();
      if (filters) body.filters = filters;
      if (properties.length) body.properties = properties;
      view = instanceView;
      okText = '已查询实例';
    } else if (op === 'execute-action') {
      const missing = requireText([
        ['动作名', val(form, 'exec_name')],
        ['实例主键', val(form, 'exec_id')],
      ]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      const params = parseJson(val(form, 'exec_params'), {}, '参数');
      if (!params.ok) return finish(ctx, host, params);
      if (!params.value || typeof params.value !== 'object' || Array.isArray(params.value)) {
        return finish(ctx, host, { ok: false, detail: '参数须为 JSON 对象' });
      }
      method = 'POST';
      path = '/api/v1/ontology/actions/execute';
      body = {
        session_id: sid,
        action_name: val(form, 'exec_name').trim(),
        instance_id: coerceId(val(form, 'exec_id')),
        parameters: params.value,
        dry_run: checked(form, 'dry_run'),
      };
      view = function (data) {
        return '<div class="sec-model-muted">动作 ' + esc(data.action_name || '') + ' · 实例 '
          + esc(data.target_instance_id || '') + '</div>';
      };
      okText = '已执行动作';
    } else if (op === 'list-audit') {
      const limit = positiveInt(val(form, 'audit_limit'), 50, '条数');
      if (!limit.ok) return finish(ctx, host, limit);
      path = withQuery('/api/v1/ontology/audit', { limit: limit.value });
      view = function (data) { return auditTable(data.audits || []); };
      okText = '已加载审计';
    } else if (op === 'schema') {
      path = '/api/v1/ontology/schema';
      view = schemaView;
      okText = '已加载摘要';
    } else {
      return finish(ctx, host, { ok: false, detail: '未知操作' });
    }

    await withBusy(button, async function () {
      const res = await callApi(ctx, method, path, body);
      finish(ctx, host, res, view, okText);
    });
  }

  function traverseBody(form, sid) {
    const missing = requireText([
      ['源对象类型', val(form, 'source_object_type')],
      ['源实例主键', val(form, 'source_instance_id')],
      ['关系名', val(form, 'link_name')],
    ]);
    if (missing) return { ok: false, detail: missing };
    const limit = positiveInt(val(form, 'limit'), 50, '条数上限');
    if (!limit.ok) return limit;
    const maxHops = positiveInt(val(form, 'max_hops'), 4, '最大跳数');
    if (!maxHops.ok) return maxHops;
    const linkPath = parseList(val(form, 'link_path'));
    return {
      ok: true,
      body: {
        session_id: sid,
        source_object_type: val(form, 'source_object_type').trim(),
        source_instance_id: coerceId(val(form, 'source_instance_id')),
        link_name: val(form, 'link_name').trim(),
        limit: limit.value,
        link_path: linkPath.length ? linkPath : null,
        max_hops: maxHops.value,
      },
    };
  }

  async function runTraverse(ctx, form, root, button) {
    const built = traverseBody(form, sessionId(ctx));
    const host = root.querySelector('.sec-model-traverse-host');
    if (!built.ok) {
      finish(ctx, host, built);
      return;
    }
    await withBusy(button, async function () {
      const res = await callApi(ctx, 'POST', '/api/v1/ontology/instances/traverse', built.body);
      finish(ctx, host, res, traverseView, '下钻完成');
    });
  }

  async function runGraph(ctx, root, button) {
    const host = root.querySelector('.sec-model-graph-host');
    await withBusy(button, async function () {
      const res = await callApi(ctx, 'GET', '/api/v1/ontology/entity_graph');
      if (!res.ok) {
        finish(ctx, host, res);
        return;
      }
      const source = root.querySelector('[data-form="traverse"]');
      const currentId = source ? val(source, 'source_object_type').trim() : '';
      host.innerHTML = graphMarkup(res.data, '实体图', currentId);
      notify(ctx, '已加载实体图', 'ok');
    });
  }

  async function runMetrics(ctx, form, host, button) {
    const op = val(form, 'op');
    const sid = sessionId(ctx);
    let path = '';
    let method = 'GET';
    let body;
    let view = function () { return ''; };
    let okText = '已完成';

    if (op === 'list-tables') {
      path = withQuery('/api/v1/catalog/tables', {
        session_id: sid,
        keyword: val(form, 'keyword').trim(),
        tag: val(form, 'tag').trim(),
      });
      view = function (data) { return catalogTable(data.tables || []); };
      okText = '已刷新目录';
    } else if (op === 'register-table') {
      const missing = requireText([['数据集', val(form, 'dataset_name')]]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      method = 'POST';
      path = withQuery('/api/v1/catalog/tables', { session_id: sid });
      body = {
        dataset_name: val(form, 'dataset_name').trim(),
        display_name: val(form, 'display_name').trim() || null,
        description: val(form, 'table_desc').trim(),
        tags: parseList(val(form, 'table_tags')),
      };
      view = function (data) { return catalogTable([data]); };
      okText = '已注册资产';
    } else if (op === 'lineage') {
      path = withQuery('/api/v1/catalog/lineage', { session_id: sid });
      view = function (data) {
        const current = val(form, 'dataset_name').trim() || val(form, 'metric_table').trim();
        return graphMarkup(data, '血缘', current);
      };
      okText = '已刷新血缘';
    } else if (op === 'list-metrics') {
      path = withQuery('/api/v1/catalog/metrics', { session_id: sid });
      view = function (data) { return metricTable(data.metrics || []); };
      okText = '已刷新指标';
    } else if (op === 'register-metric') {
      const missing = requireText([
        ['指标名', val(form, 'metric_name')],
        ['公式', val(form, 'metric_formula')],
        ['表', val(form, 'metric_table')],
      ]);
      if (missing) return finish(ctx, host, { ok: false, detail: missing });
      method = 'POST';
      path = withQuery('/api/v1/catalog/metrics', { session_id: sid });
      body = {
        name: val(form, 'metric_name').trim(),
        formula: val(form, 'metric_formula').trim(),
        table_name: val(form, 'metric_table').trim(),
        aggregation_type: val(form, 'aggregation_type') || 'CUSTOM',
        dimensions: parseList(val(form, 'metric_dims')),
      };
      if (body.aggregation_type === 'RATIO') {
        const numerator = val(form, 'numerator_metric').trim();
        const denominator = val(form, 'denominator_metric').trim();
        if (numerator) body.numerator_metric = numerator;
        if (denominator) body.denominator_metric = denominator;
      }
      view = function (data) { return metricTable([data]); };
      okText = '已注册指标';
    } else if (op === 'query-metrics') {
      const names = parseList(val(form, 'query_metrics'));
      if (!names.length) return finish(ctx, host, { ok: false, detail: '指标不能为空' });
      const limit = positiveInt(val(form, 'query_limit'), 100, '条数');
      if (!limit.ok) return finish(ctx, host, limit);
      const dimensions = parseList(val(form, 'query_dims'));
      method = 'POST';
      path = '/api/v1/catalog/metrics/query';
      body = {
        session_id: sid,
        metric_names: names,
        limit: limit.value,
      };
      if (dimensions.length) body.dimensions = dimensions;
      const filters = val(form, 'query_filters').trim();
      const orderBy = val(form, 'query_order').trim();
      if (filters) body.filters = filters;
      if (orderBy) body.order_by = orderBy;
      view = metricQueryView;
      okText = '已查询指标';
    } else {
      return finish(ctx, host, { ok: false, detail: '未知操作' });
    }

    await withBusy(button, async function () {
      const res = await callApi(ctx, method, path, body);
      finish(ctx, host, res, view, okText);
    });
  }

  function activate(root, tab) {
    root.querySelectorAll('.sec-model-tab').forEach(function (button) {
      const on = button.getAttribute('data-tab') === tab;
      button.classList.toggle('sec-model-tab-active', on);
      button.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    root.querySelectorAll('.sec-model-pane').forEach(function (pane) {
      pane.hidden = pane.getAttribute('data-pane') !== tab;
    });
    if (tab === 'playground' && window.OntologyPlayground) {
      const host = root.querySelector('[data-pane="playground"]');
      if (host && !host.dataset.ready) {
        host.dataset.ready = '1';
        window.OntologyPlayground.mount(host, ctx);
      }
    }
  }

  function ensureFonts() {
    if (document.getElementById('sec-model-fonts')) return;
    const link = document.createElement('link');
    link.id = 'sec-model-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Noto+Sans+SC:wght@400;500&family=Noto+Serif+SC:wght@500;600&family=Outfit:wght@300;400;500&display=swap';
    document.head.appendChild(link);
  }

  function mount(container, ctx) {
    if (!container) throw new Error('模型段缺少容器');
    ensureFonts();
    container.innerHTML = shell();
    const root = container.querySelector('.sec-model-root');
    paintSession(root, ctx || {});
    const objectForm = root.querySelector('[data-form="objects"]');
    root.querySelector('[data-action="object-graph"]').addEventListener('click', function (event) {
      const button = event.currentTarget;
      withBusy(button, async function () {
        const res = await callApi(ctx, 'GET', '/api/v1/ontology/entity_graph');
        finish(ctx, root.querySelector('.sec-model-object-graph'), res, function (data) { return graphMarkup(data, '业务对象星图', ''); }, '已加载业务关系图');
      });
    });
    const traverseForm = root.querySelector('[data-form="traverse"]');
    const metricForm = root.querySelector('[data-form="metrics"]');
    syncObjectForm(objectForm);
    syncMetricForm(metricForm);
    setDefault(traverseForm, 'limit', '50');
    setDefault(traverseForm, 'max_hops', '4');
    setDefault(objectForm, 'q_limit', '50');
    setDefault(objectForm, 'audit_limit', '50');
    setDefault(metricForm, 'query_limit', '100');
    objectForm.addEventListener('change', function (event) {
      if (event.target && (event.target.name === 'op' || event.target.name === 'cardinality')) syncObjectForm(objectForm);
    });
    metricForm.addEventListener('change', function (event) {
      if (event.target && (event.target.name === 'op' || event.target.name === 'aggregation_type')) syncMetricForm(metricForm);
    });
    objectForm.addEventListener('submit', function (event) {
      event.preventDefault();
      paintSession(root, ctx);
      runObject(ctx, objectForm, root.querySelector('[data-result="objects"]'), event.submitter || objectForm.querySelector('.sec-model-submit'));
    });
    metricForm.addEventListener('submit', function (event) {
      event.preventDefault();
      paintSession(root, ctx);
      runMetrics(ctx, metricForm, root.querySelector('[data-result="metrics"]'), event.submitter || metricForm.querySelector('.sec-model-submit'));
    });
    traverseForm.addEventListener('submit', function (event) {
      event.preventDefault();
      paintSession(root, ctx);
      runTraverse(ctx, traverseForm, root, event.submitter || traverseForm.querySelector('[data-action="traverse"]'));
    });
    traverseForm.querySelector('[data-action="graph"]').addEventListener('click', function (event) {
      paintSession(root, ctx);
      runGraph(ctx, root, event.currentTarget);
    });
    root.querySelectorAll('.sec-model-tab').forEach(function (button) {
      button.addEventListener('click', function () { activate(root, button.getAttribute('data-tab')); });
    });
    const viewId = ctx && ctx.view && ctx.view.id;
    if (viewId === 'objects' || viewId === 'playground' || viewId === 'traverse' || viewId === 'metrics') activate(root, viewId);
  }

  window.DashboardSections = window.DashboardSections || {};
  window.DashboardSections.model = { mount: mount };
})();
