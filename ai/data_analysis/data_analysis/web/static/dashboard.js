// Pipeline dashboard. Every stage runs against ONE analytical session; multiple
// data sources (many DBs / files / trace sets) coexist as distinct datasets in
// that session and in the Data Catalog. Telemetry collection is NOT here — it is
// an optional demo under examples/telemetry-collector-demo.

// Unguessable: the session id is the handle to the data loaded into it.
const SESSION_ID = 'dashboard-' + (crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join(''));

// Every /api/v1 route needs X-API-Key. The key is asked for once and kept in
// sessionStorage (this tab only); a 401/403 clears it so a wrong key can be re-entered.
const API_KEY_STORE = 'data-agent-api-key';
function apiKey(forceAsk = false) {
  let key = null;
  try { key = sessionStorage.getItem(API_KEY_STORE); } catch (_) { /* storage blocked */ }
  if (!key || forceAsk) {
    key = (window.prompt('API Key (X-API-Key). Leave empty when DATA_ANALYSIS_REQUIRE_AUTH=false.') || '').trim();
    try { key ? sessionStorage.setItem(API_KEY_STORE, key) : sessionStorage.removeItem(API_KEY_STORE); } catch (_) { /* ignore */ }
  }
  return key;
}
async function authedFetch(path, opts = {}) {
  const send = (key) => fetch(path, { ...opts, headers: { ...(opts.headers || {}), ...(key ? { 'X-API-Key': key } : {}) } });
  let key = null;
  try { key = sessionStorage.getItem(API_KEY_STORE); } catch (_) { /* ignore */ }
  let res = await send(key);
  if (res.status === 401 || res.status === 403) res = await send(apiKey(true));
  return res;
}
const TRACE_DS = 'demo_traces';

const SAMPLE_TRACES = [
  { event_name:'$pageview', event_type:'pageview', user_id:'u1', session_id:'s1', trace_id:'t1', span_id:'a1', page_path:'/home', timestamp_ms:1 },
  { event_name:'view_item', event_type:'custom', user_id:'u1', session_id:'s1', trace_id:'t1', span_id:'a2', parent_span_id:'a1', page_path:'/product', timestamp_ms:2, duration_ms:120 },
  { event_name:'add_to_cart', event_type:'custom', user_id:'u1', session_id:'s1', trace_id:'t1', span_id:'a3', parent_span_id:'a2', page_path:'/cart', timestamp_ms:3, duration_ms:80 },
  { event_name:'purchase_success', event_type:'custom', user_id:'u1', session_id:'s1', trace_id:'t1', span_id:'a4', parent_span_id:'a3', page_path:'/success', timestamp_ms:4, duration_ms:200 },
  { event_name:'$pageview', event_type:'pageview', user_id:'u2', session_id:'s2', trace_id:'t2', span_id:'b1', page_path:'/home', timestamp_ms:1 },
  { event_name:'view_item', event_type:'custom', user_id:'u2', session_id:'s2', trace_id:'t2', span_id:'b2', parent_span_id:'b1', page_path:'/product', timestamp_ms:2, duration_ms:90 },
  { event_name:'add_to_cart', event_type:'custom', user_id:'u2', session_id:'s2', trace_id:'t2', span_id:'b3', parent_span_id:'b2', page_path:'/cart', timestamp_ms:3, duration_ms:75 },
  { event_name:'$error', event_type:'error', user_id:'u3', session_id:'s3', trace_id:'t3', span_id:'c1', page_path:'/cart', timestamp_ms:1, properties:{ message:'NullPointer' } },
];

let activeDataset = null;   // drives generic stages (transform/EDA/quality/activate/catalog)
let traceDataset = null;    // drives trace-only stages (funnel/waterfall)
let mySources = [];         // datasets ingested in THIS session (multi-source)
let baselineSchema = null;  // captured schema for drift detection

function setActive(ds, { isTrace = false } = {}) {
  activeDataset = ds;
  if (isTrace) traceDataset = ds;
  const el = document.getElementById('active-ds');
  if (el) el.textContent = ds || '（无）';
  renderSources();
}

function addSource(name, kind) {
  if (!mySources.find(s => s.name === name)) mySources.push({ name, kind });
  renderSources();
}

function renderSources() {
  const el = document.getElementById('my-sources');
  if (!el) return;
  if (!mySources.length) { el.textContent = '尚未接入任何数据源。'; return; }
  el.innerHTML = mySources.map(s => {
    const on = s.name === activeDataset;
    return `<div class="flex items-center justify-between py-1 border-b border-white/5">
      <span class="mono ${on ? 'text-indigo-400' : 'text-slate-300'}">${esc(s.name)} <span class="text-slate-600">· ${esc(s.kind)}</span>${on ? ' <span class="text-emerald-500">● 活跃</span>' : ''}</span>
      <button onclick="setActive('${esc(s.name)}',{isTrace:${s.kind === 'trace'}})" class="btn btn-s">设为活跃</button>
    </div>`;
  }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('session-badge').textContent = SESSION_ID;
  document.querySelectorAll('.stage-pill').forEach(p =>
    p.addEventListener('click', () => showStage(p.dataset.stage)));
  showStage('ingest');
  loadExamples();
});

// ---------- 行业示例 (Examples) ----------
async function loadExamples() {
  const list = document.getElementById('examples-list');
  if (!list) return;
  try {
    const data = await api('GET', '/api/v1/examples');
    list.innerHTML = (data.examples || []).map(e => `
      <div class="subcard p-4 space-y-2">
        <div class="text-xs font-semibold text-slate-200">${esc(e.name)} <span class="text-slate-500">· ${esc(e.domain)}</span></div>
        <div class="text-[0.7rem] text-slate-500">${esc(e.description)}</div>
        <button onclick="runExample('${esc(e.id)}', this)" class="btn btn-p w-full">▶ 运行该示例管道</button>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="text-rose-500 text-xs">加载示例失败：${esc(e.message)}</div>`;
  }
}

async function runExample(id, btn) {
  const status = document.getElementById('examples-status');
  const out = document.getElementById('example-report');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 运行中…'; }
  if (status) status.textContent = `运行 ${id} 管道中…`;
  try {
    const r = await api('POST', `/api/v1/examples/${id}/run`, { session_id: SESSION_ID });
    // The example's dataset now lives in THIS session — make it explorable.
    addSource(r.dataset_name, id === 'dota2' ? 'trace' : 'db');
    setActive(r.dataset_name, { isTrace: id === 'dota2' });
    ['ingest', 'analyze', 'model', 'quality'].forEach(markDone);
    out.classList.remove('hidden');
    out.innerHTML = window.marked ? window.marked.parse(r.report_markdown) : ('<pre class="out">' + esc(r.report_markdown) + '</pre>');
    const ins = (r.insights && r.insights.total_insights) || 0;
    if (status) status.textContent = `✔ ${r.name} 完成 · 数据集 '${r.dataset_name}' 已载入会话 · ${ins} 条洞察`;
  } catch (e) {
    if (status) status.textContent = '✘ ' + e.message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '▶ 运行该示例管道'; }
  }
}

function showStage(stage) {
  document.querySelectorAll('[data-stage-pane]').forEach(p => p.classList.add('hidden'));
  const pane = document.getElementById('pane-' + stage);
  if (pane) pane.classList.remove('hidden');
  document.querySelectorAll('.stage-pill').forEach(p =>
    p.classList.toggle('active', p.dataset.stage === stage));
  if (stage === 'model') { loadCatalog(); loadLineage(); loadMetrics(); }
}

function markDone(stage) {
  const pill = document.querySelector(`.stage-pill[data-stage="${stage}"]`);
  if (pill) pill.classList.add('done');
}

function setOut(id, text, ok = true) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('text-emerald-400', ok);
  el.classList.toggle('text-rose-500', !ok);
}

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function pretty(obj) { return JSON.stringify(obj, null, 2); }

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await authedFetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || (`HTTP ${res.status}`));
  return data;
}

function ds() { return activeDataset || TRACE_DS; }
function traceDs() { return traceDataset || TRACE_DS; }
async function ensureIngested() { if (!activeDataset) await ingestTraces(); }

// ---------- 01 Ingest (multi-source) ----------
async function connectDb() {
  const conn_str = document.getElementById('db-conn').value.trim();
  const query_or_table = document.getElementById('db-query').value.trim();
  const dataset_name = document.getElementById('db-ds').value.trim() || 'db_source';
  const limitRaw = document.getElementById('db-limit').value.trim();
  const mode = (document.getElementById('db-mode') || {}).value || 'materialize';
  if (!conn_str || !query_or_table) { setOut('out-ingest', '✘ 请填写连接串与表名/查询', false); return; }
  try {
    const body = { conn_str, query_or_table, dataset_name, session_id: SESSION_ID, mode };
    if (limitRaw) body.limit = parseInt(limitRaw, 10);
    const r = await api('POST', '/api/v1/connect', body);
    addSource(dataset_name, 'db'); setActive(dataset_name); markDone('ingest');
    setOut('out-ingest', `✔ Path A (DB): ${r.summary_text || '已载入'}`);
    loadCatalog();
  } catch (e) { setOut('out-ingest', '✘ 连接失败: ' + e.message, false); }
}

async function uploadFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const dataset_name = document.getElementById('file-ds').value.trim() || 'file_source';
  const fd = new FormData();
  fd.append('file', file); fd.append('dataset_name', dataset_name); fd.append('session_id', SESSION_ID);
  try {
    const res = await authedFetch('/api/v1/import/file', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
    addSource(dataset_name, 'file'); setActive(dataset_name); markDone('ingest');
    setOut('out-ingest', `✔ Path A (文件): ${data.summary || '已载入'}\n列: ${(data.columns || []).join(', ')}`);
    loadCatalog();
  } catch (e) { setOut('out-ingest', '✘ 上传失败: ' + e.message, false); }
  input.value = '';
}

async function importTraceSource() {
  const source = document.getElementById('trace-source').value.trim();
  const dataset_name = document.getElementById('trace-ds').value.trim() || 'traces';
  if (!source) { setOut('out-ingest', '✘ 请填写 trace 路径，或用“上传 JSON”', false); return; }
  await doImportTraces({ source, dataset_name });
}

async function importTraceFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const dataset_name = document.getElementById('trace-ds').value.trim() || 'traces';
  try {
    const text = await file.text();
    let obj;
    try { obj = JSON.parse(text); } catch { obj = text.split('\n').filter(Boolean).map(l => JSON.parse(l)); }
    const records = Array.isArray(obj) ? obj : (obj.events || null);
    if (!records) { setOut('out-ingest', '✘ 仅支持 JSON 数组或 {events:[...]}；OTLP 用“按路径导入”', false); input.value=''; return; }
    await doImportTraces({ records, dataset_name });
  } catch (e) { setOut('out-ingest', '✘ 解析失败: ' + e.message, false); }
  input.value = '';
}

async function doImportTraces(payload) {
  try {
    const r = await api('POST', '/api/v1/import/traces', { ...payload, session_id: SESSION_ID });
    addSource(r.dataset_name, 'trace'); setActive(r.dataset_name, { isTrace: true }); markDone('ingest');
    setOut('out-ingest', `✔ Path B (trace): 导入 ${r.row_count} 条 span/event → 表 '${r.dataset_name}'`);
    loadCatalog();
  } catch (e) { setOut('out-ingest', '✘ trace 导入失败: ' + e.message, false); }
}

async function ingestTraces() {
  const dataset_name = document.getElementById('trace-ds')?.value.trim() || TRACE_DS;
  await doImportTraces({ records: SAMPLE_TRACES, dataset_name });
}

// ---------- 03 Data Catalog ----------
async function loadCatalog() {
  try {
    const data = await api('GET', `/api/v1/catalog/tables?session_id=${SESSION_ID}`);
    const rows = (data.tables || []).map(t =>
      `<tr><td class="mono text-indigo-400">${esc(t.dataset_name)}</td><td>${t.row_count ?? '?'}</td><td>${t.column_count ?? '?'}</td><td class="text-slate-500">${esc((t.tags||[]).join(', '))}</td><td class="text-slate-500">${esc(t.description || '')}</td></tr>`).join('');
    const body = document.getElementById('catalog-tbody');
    if (body) body.innerHTML = rows || '<tr><td colspan="5" class="text-slate-500">目录为空</td></tr>';
  } catch (e) { const b = document.getElementById('catalog-tbody'); if (b) b.innerHTML = `<tr><td colspan="5" class="text-rose-500">${esc(e.message)}</td></tr>`; }
}

async function loadLineage() {
  try {
    const g = await api('GET', `/api/v1/catalog/lineage?session_id=${SESSION_ID}`);
    const el = document.getElementById('lineage-view');
    if (!g.nodes || !g.nodes.length) { el.textContent = '（暂无血缘；执行 DAG 或语义查询后生成）'; return; }
    const nodes = g.nodes.map(n => `<span class="inline-block px-2 py-0.5 rounded bg-slate-800 text-slate-300 mr-1 mb-1 mono">${esc(n.name)}</span>`).join('');
    const edges = (g.edges || []).map(e => `<div class="mono text-slate-400">${esc(e.source)} <span class="text-indigo-500">→</span> ${esc(e.target)}</div>`).join('') || '<div class="text-slate-600">（无依赖边）</div>';
    el.innerHTML = `<div class="mb-2">${nodes}</div>${edges}`;
  } catch (e) { document.getElementById('lineage-view').textContent = e.message; }
}

async function loadMetrics() {
  try {
    const data = await api('GET', `/api/v1/catalog/metrics?session_id=${SESSION_ID}`);
    const el = document.getElementById('metrics-view');
    const items = (data.metrics || []).map(m =>
      `<div class="mono">${esc(m.name || m.metric_name)} <span class="text-slate-500">= ${esc(m.formula || m.aggregation_type || '')}</span> <span class="text-slate-600">(${esc(m.table_name||'')})</span></div>`).join('');
    el.innerHTML = items || '<span class="text-slate-600">（暂无指标，注册一个）</span>';
  } catch (e) { document.getElementById('metrics-view').textContent = e.message; }
}

async function registerMetric() {
  const name = document.getElementById('metric-name').value.trim();
  const formula = document.getElementById('metric-formula').value.trim();
  if (!name || !formula) { alert('请填写指标名与公式'); return; }
  try {
    await api('POST', `/api/v1/catalog/metrics?session_id=${SESSION_ID}`, { name, formula, table_name: ds(), aggregation_type: 'CUSTOM' });
    markDone('model'); loadMetrics();
  } catch (e) { document.getElementById('metrics-view').textContent = '注册失败: ' + e.message; }
}

// ---------- 02 Transform ----------
async function runTransform() {
  try {
    await ensureIngested();
    const r = await api('POST', '/api/v1/transform/clean', { session_id: SESSION_ID, source_table: ds(), target_table: ds() + '_clean' });
    markDone('transform');
    setOut('out-transform', '✔ 清洗完成:\n' + pretty(r));
  } catch (e) { setOut('out-transform', '清洗: ' + e.message, false); }
}

async function registerDag() {
  const name = document.getElementById('dag-name').value.trim();
  const sql = document.getElementById('dag-sql').value.trim();
  if (!name || !sql) { setOut('out-dag', '✘ 请填写模型名与 SQL', false); return; }
  try {
    await api('POST', `/api/v1/transform/dag/models?session_id=${SESSION_ID}`, { name, sql, materialization: 'table' });
    setOut('out-dag', `✔ 已注册模型 '${name}'。点“物化执行 DAG”运行。`);
  } catch (e) { setOut('out-dag', '注册失败: ' + e.message, false); }
}

async function runDag() {
  try {
    await ensureIngested();
    const r = await api('POST', `/api/v1/transform/dag/run?session_id=${SESSION_ID}`);
    markDone('transform');
    setOut('out-dag', '✔ DAG 物化执行:\n' + pretty(r));
    loadLineage();
  } catch (e) { setOut('out-dag', 'DAG 执行: ' + e.message, false); }
}

// ---------- 04 Analyze ----------
async function runEDA() {
  try { await ensureIngested();
    const r = await api('POST', '/api/v1/tools/eda', { session_id: SESSION_ID, dataset_name: ds() });
    markDone('analyze'); setOut('out-analyze', '✔ EDA 画像:\n' + (r.summary_text || pretty(r.statistics)).slice(0, 900));
  } catch (e) { setOut('out-analyze', 'EDA: ' + e.message, false); }
}
async function runFunnel() {
  try { await ensureIngested();
    const r = await api('POST', '/api/v1/analytics/funnel', { session_id: SESSION_ID, dataset_name: traceDs(), steps: ['view_item','add_to_cart','purchase_success'] });
    markDone('analyze'); setOut('out-analyze', `✔ 漏斗 (trace):\n总转化率 ${(r.overall_conversion_rate*100).toFixed(1)}% · 起始 ${r.initial_users} → 成单 ${r.final_converted_users}\n` + pretty(r.steps));
  } catch (e) { setOut('out-analyze', '漏斗: ' + e.message, false); }
}
async function runWaterfall() {
  try { await ensureIngested();
    const r = await api('GET', `/api/v1/analytics/trace/t1?session_id=${SESSION_ID}&dataset_name=${traceDs()}`);
    markDone('analyze'); setOut('out-analyze', `✔ Trace t1 span 瀑布 (${r.total_spans} spans):\n` + pretty(r.spans));
  } catch (e) { setOut('out-analyze', '瀑布: ' + e.message, false); }
}
async function runInsights() {
  try { await ensureIngested();
    setOut('out-analyze', '⏳ Insight Copilot 编排分析中…');
    const r = await api('POST', '/api/v1/insights/discover', { session_id: SESSION_ID, dataset_name: ds() });
    markDone('analyze');
    const nar = r.narrative || {};
    const lines = [
      `✔ Insight Copilot（${r.total_insights} 条洞察，图谱 ${r.insight_graph.nodes.length} 节点/${r.insight_graph.edges.length} 关系）`,
      '', nar.headline || '', ...(nar.sections || []),
      '', '洞察清单:',
      ...r.insights.map(i => `  · [${i.type}] ${i.title} (severity ${i.severity})`),
      '', '建议: ' + (nar.recommendation || '—'),
    ];
    setOut('out-analyze', lines.join('\n'));
  } catch (e) { setOut('out-analyze', 'Insight Copilot: ' + e.message, false); }
}

// ---------- 05 Quality ----------
async function runQuality() {
  try { await ensureIngested();
    const r = await api('POST', '/api/v1/observability/assert', { session_id: SESSION_ID, table: ds(), rules: [{ type:'row_count', min_rows:1, max_rows:100000000 }] });
    markDone('quality'); setOut('out-quality', '✔ 质量断言:\n' + pretty(r));
  } catch (e) { setOut('out-quality', '质量: ' + e.message, false); }
}
async function captureBaseline() {
  try { await ensureIngested();
    const r = await api('POST', '/api/v1/tools/sql', { session_id: SESSION_ID, sql_query: `SELECT column_name, column_type FROM (DESCRIBE ${ds()})`, limit: 500 });
    baselineSchema = {};
    (r.data_preview || []).forEach(row => { baselineSchema[row.column_name] = String(row.column_type).toUpperCase(); });
    setOut('out-drift', `✔ 已捕获基线 (${Object.keys(baselineSchema).length} 列) for '${ds()}'。改动数据源后点“检测漂移”。`);
  } catch (e) { setOut('out-drift', '捕获基线失败: ' + e.message, false); }
}
async function detectDrift() {
  if (!baselineSchema) { setOut('out-drift', '✘ 请先捕获基线', false); return; }
  try {
    const r = await api('POST', '/api/v1/observability/drift', { session_id: SESSION_ID, table: ds(), baseline_schema: baselineSchema });
    markDone('quality'); setOut('out-drift', '✔ 漂移检测:\n' + pretty(r));
  } catch (e) { setOut('out-drift', '漂移检测: ' + e.message, false); }
}

// ---------- 06 Activate ----------
async function runActivate() {
  try { await ensureIngested();
    const r = await api('POST', '/api/v1/retl/audience', { session_id: SESSION_ID, source_table: ds(), format_type: 'json', limit: 50 });
    markDone('activate'); setOut('out-activate', '✔ 受众/结果导出:\n' + pretty(r));
  } catch (e) { setOut('out-activate', '激活: ' + e.message, false); }
}
async function runSync() {
  try { await ensureIngested();
    const dest_conn_str = document.getElementById('sync-dest').value.trim();
    const dest_table_name = document.getElementById('sync-table').value.trim() || 'synced_result';
    const r = await api('POST', '/api/v1/retl/sync', { session_id: SESSION_ID, source_table: ds(), dest_conn_str, dest_table_name, mode: 'replace' });
    markDone('activate'); setOut('out-sync', '✔ 反向同步:\n' + pretty(r));
  } catch (e) { setOut('out-sync', '同步: ' + e.message, false); }
}
async function runAlert() {
  const webhook_url = document.getElementById('alert-url').value.trim();
  const platform = document.getElementById('alert-platform').value;
  if (!webhook_url) { setOut('out-alert', '✘ 请填写 webhook_url', false); return; }
  try {
    const r = await api('POST', '/api/v1/retl/alert', { webhook_url, platform, title: '数据异动告警', message: '来自 MDS 管道的示例告警' });
    markDone('activate'); setOut('out-alert', '✔ 告警下发:\n' + pretty(r));
  } catch (e) { setOut('out-alert', '告警: ' + e.message, false); }
}

// ---------- One-click ----------
async function runFullPipeline() {
  await ingestTraces();
  await runTransform();
  showStage('model');
  await loadCatalog(); await loadLineage(); await loadMetrics();
  await runFunnel();
  await runQuality();
  await runActivate();
}
