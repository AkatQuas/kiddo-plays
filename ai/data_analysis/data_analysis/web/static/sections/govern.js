/* 质量（断言、漂移）与激活（写回、受众、告警）。由看板壳调用 mount。 */
(function () {
  "use strict";

  window.DashboardSections = window.DashboardSections || {};

  var RULE_TYPES = [
    { value: "not_null", label: "非空 not_null" },
    { value: "unique", label: "唯一 unique" },
    { value: "between", label: "区间 between" },
    { value: "row_count", label: "行数 row_count" },
  ];

  var PLATFORMS = [
    { value: "feishu", label: "飞书 feishu" },
    { value: "dingtalk", label: "钉钉 dingtalk" },
    { value: "wecom", label: "企业微信 wecom" },
    { value: "slack", label: "Slack slack" },
    { value: "generic", label: "通用 generic" },
  ];

  var MODES = [
    { value: "replace", label: "覆盖 replace" },
    { value: "append", label: "追加 append" },
  ];

  var FORMATS = [
    { value: "json", label: "JSON" },
    { value: "csv", label: "CSV" },
  ];

  var INK = "#0e0d0b";
  var LIFT = "#161410";
  var LINE = "rgba(243,239,230,0.12)";
  var PAPER = "#f4f0e6";
  var QUIET = "#a39b8e";
  var GOLD = "#c6a15b";
  var FAIL = "#c45c4a";
  var TITLE = '"Cormorant Garamond","Noto Serif SC","Noto Serif CJK SC","Songti SC",serif';
  var UI = 'Outfit,"Noto Sans CJK SC","PingFang SC","Microsoft YaHei",sans-serif';

  var CSS = [
    ".sec-govern-root{background:" + INK + ";color:" + PAPER + ";border:0;border-radius:0;margin:-16px -18px -24px;min-height:calc(100vh - 80px);padding:0;color-scheme:dark;font:13px/1.5 " + UI + ";}",
    ".sec-govern-root *{box-sizing:border-box;}",
    ".sec-govern-bar{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px 28px;padding:22px 28px 0;border-bottom:1px solid " + LINE + ";background:" + INK + ";}",
    ".sec-govern-group{display:flex;align-items:flex-end;gap:14px;min-width:0;}",
    ".sec-govern-group-name{font-family:" + TITLE + ";font-size:28px;font-weight:500;letter-spacing:.12em;line-height:1;color:" + PAPER + ";padding-bottom:10px;}",
    ".sec-govern-tabs{display:flex;gap:16px;}",
    ".sec-govern-tab{border:0;border-bottom:1px solid transparent;border-radius:0;background:transparent;color:" + QUIET + ";padding:8px 0 10px;font:inherit;font-size:13px;letter-spacing:.08em;cursor:pointer;}",
    ".sec-govern-tab:hover{background:transparent;color:" + PAPER + ";}",
    ".sec-govern-tab-active{border-bottom-color:" + GOLD + ";background:transparent;color:" + GOLD + ";font-weight:500;}",
    ".sec-govern-session{margin-left:auto;padding-bottom:12px;font-size:12px;letter-spacing:.04em;color:" + QUIET + ";max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
    ".sec-govern-session-id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;color:" + PAPER + ";}",
    ".sec-govern-split{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);min-height:420px;background:" + INK + ";}",
    ".sec-govern-form{padding:22px 24px 28px;border-right:1px solid " + LINE + ";display:flex;flex-direction:column;gap:14px;background:" + LIFT + ";}",
    ".sec-govern-result{padding:22px 28px 32px;background:" + INK + ";overflow:auto;min-width:0;}",
    ".sec-govern-hint,.sec-govern-muted{margin:0;font-size:12px;line-height:1.55;color:" + QUIET + ";}",
    ".sec-govern-field{display:flex;flex-direction:column;gap:4px;}",
    ".sec-govern-label{font-size:12px;font-weight:500;letter-spacing:.06em;color:" + PAPER + ";}",
    ".sec-govern-key{font-weight:400;color:" + QUIET + ";font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:0;}",
    ".sec-govern-input,.sec-govern-select,.sec-govern-textarea{width:100%;border:0;border-bottom:1px solid " + LINE + ";border-radius:0;background-color:transparent;color:" + PAPER + ";padding:8px 0;font:inherit;font-size:13px;}",
    ".sec-govern-input::placeholder,.sec-govern-textarea::placeholder{color:" + QUIET + ";}",
    ".sec-govern-select{appearance:none;background-image:url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' fill='none' stroke='%23a39b8e' stroke-width='1'/></svg>\");background-repeat:no-repeat;background-position:right center;padding-right:18px;}",
    ".sec-govern-select option{background:" + LIFT + ";color:" + PAPER + ";}",
    ".sec-govern-textarea{min-height:72px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}",
    ".sec-govern-pair{display:grid;grid-template-columns:1fr 1fr;gap:12px;}",
    ".sec-govern-rule{border:1px solid " + LINE + ";border-radius:0;padding:12px;display:flex;flex-direction:column;gap:8px;background:" + INK + ";}",
    ".sec-govern-rule-top,.sec-govern-inline{display:flex;gap:10px;align-items:center;}",
    ".sec-govern-rule-top .sec-govern-select,.sec-govern-inline .sec-govern-input{width:auto;flex:1;min-width:0;}",
    ".sec-govern-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;}",
    ".sec-govern-btn{border:1px solid " + LINE + ";background:transparent;color:" + PAPER + ";border-radius:0;padding:8px 14px;font:inherit;font-size:12px;letter-spacing:.08em;white-space:nowrap;flex:none;cursor:pointer;}",
    ".sec-govern-btn:hover{background:transparent;border-color:rgba(243,239,230,0.28);color:" + PAPER + ";}",
    ".sec-govern-btn-primary{background:" + GOLD + ";border-color:" + GOLD + ";color:" + INK + ";}",
    ".sec-govern-btn-primary:hover{background:" + GOLD + ";border-color:" + GOLD + ";color:" + INK + ";}",
    ".sec-govern-btn:disabled{opacity:.45;cursor:default;}",
    ".sec-govern-tab:focus-visible,.sec-govern-btn:focus-visible,.sec-govern-input:focus-visible,.sec-govern-select:focus-visible,.sec-govern-textarea:focus-visible,.sec-govern-summary:focus-visible{outline:1px solid rgba(243,239,230,0.45);outline-offset:2px;}",
    ".sec-govern-tab-active:focus-visible,.sec-govern-btn-primary:focus-visible{outline-color:" + GOLD + ";}",
    ".sec-govern-error{border:0;border-left:2px solid " + FAIL + ";border-radius:0;padding:2px 0 2px 12px;background:transparent;}",
    ".sec-govern-error-label{font-size:11px;font-weight:500;letter-spacing:.16em;color:" + FAIL + ";margin-bottom:6px;}",
    ".sec-govern-error .sec-govern-pre{color:" + PAPER + ";background:transparent;}",
    ".sec-govern-pre{margin:0;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.5;color:" + PAPER + ";background:" + LIFT + ";padding:12px;border:1px solid " + LINE + ";border-radius:0;}",
    ".sec-govern-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:18px;margin:0 0 18px;}",
    ".sec-govern-stat{border:0;border-top:1px solid " + LINE + ";border-radius:0;padding:8px 0 0;background:transparent;}",
    ".sec-govern-stat-label{font-size:11px;letter-spacing:.04em;color:" + QUIET + ";font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}",
    ".sec-govern-stat-value{margin-top:4px;font-family:" + UI + ";font-size:28px;font-weight:500;line-height:1.15;color:" + PAPER + ";font-variant-numeric:lining-nums tabular-nums;}",
    ".sec-govern-tone-ok{color:" + PAPER + ";}",
    ".sec-govern-tone-bad{color:" + FAIL + ";}",
    ".sec-govern-block{margin-top:18px;}",
    ".sec-govern-block-title{margin:0 0 8px;font-family:" + TITLE + ";font-size:22px;font-weight:500;letter-spacing:.06em;color:" + PAPER + ";}",
    ".sec-govern-table-wrap{overflow:auto;max-height:240px;border:0;border-top:1px solid " + LINE + ";border-radius:0;}",
    ".sec-govern-table{border-collapse:collapse;width:100%;font-size:12px;background:transparent;}",
    ".sec-govern-table th,.sec-govern-table td{border-bottom:1px solid " + LINE + " !important;text-align:left;padding:8px 10px 8px 0;white-space:nowrap;color:" + PAPER + " !important;background:transparent !important;}",
    ".sec-govern-table th{color:" + QUIET + " !important;font-weight:500;letter-spacing:.06em;background:" + INK + " !important;position:sticky;top:0;}",
    ".sec-govern-raw{margin-top:18px;}",
    ".sec-govern-summary{cursor:pointer;font-size:12px;letter-spacing:.08em;color:" + QUIET + ";}",
    "@media (max-width:720px){.sec-govern-split{grid-template-columns:1fr;}.sec-govern-form{border-right:0;border-bottom:1px solid " + LINE + ";}.sec-govern-session{margin-left:0;max-width:100%;}.sec-govern-bar{padding:18px 16px 0;}.sec-govern-form,.sec-govern-result{padding-left:16px;padding-right:16px;}}",
  ].join("");

  function mount(container, ctx) {
    ensureStyle();
    var state = createState();
    var root = document.createElement("div");
    root.className = "sec-govern-root";
    container.textContent = "";
    container.appendChild(root);
    var api = { root: root, state: state, ctx: ctx || {} };
    root.addEventListener("click", function (event) { onClick(event, api); });
    root.addEventListener("input", function (event) { onField(event, api); });
    root.addEventListener("change", function (event) { onField(event, api); });
    root.addEventListener("submit", function (event) {
      var form = event.target && event.target.closest ? event.target.closest(".sec-govern-form") : null;
      if (!form || !root.contains(form)) return;
      event.preventDefault();
      submit(api);
    });
    render(api);
  }

  window.DashboardSections.govern = { mount: mount };

  function ensureStyle() {
    if (!document.getElementById("sec-govern-font")) {
      var link = document.createElement("link");
      link.id = "sec-govern-font";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Noto+Serif+SC:wght@500&family=Outfit:wght@400;500;600&display=swap";
      document.head.appendChild(link);
    }
    if (document.getElementById("sec-govern-style")) return;
    var style = document.createElement("style");
    style.id = "sec-govern-style";
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function createState() {
    return {
      tab: "assert",
      token: {},
      assert: {
        table: "",
        rules: [blankRule("row_count")],
      },
      drift: {
        table: "",
        columns: [{ name: "", type: "" }],
      },
      sync: {
        source_table: "",
        dest_conn_str: "",
        dest_table_name: "",
        mode: "replace",
        chunk_size: "50000",
      },
      audience: {
        source_table: "",
        filter_sql: "",
        export_columns: "",
        format_type: "json",
        limit: "1000",
      },
      alert: {
        webhook_url: "",
        platform: "feishu",
        title: "",
        message: "",
        extra_metrics: "",
      },
      view: {},
    };
  }

  function blankRule(type) {
    return {
      type: type || "not_null",
      column: "",
      min_val: "",
      max_val: "",
      min_rows: "0",
      max_rows: "1000000",
    };
  }

  function render(api) {
    var state = api.state;
    api.root.innerHTML = barHTML(api) + '<div class="sec-govern-split"><form class="sec-govern-form" novalidate>' +
      formHTML(state) + '</form><div class="sec-govern-result"></div></div>';
    renderResult(api.root.querySelector(".sec-govern-result"), state);
  }

  function barHTML(api) {
    return '<div class="sec-govern-bar">' +
      groupHTML("质量", [
        tabButton(api.state, "assert", "断言"),
        tabButton(api.state, "drift", "漂移"),
      ]) +
      groupHTML("激活", [
        tabButton(api.state, "sync", "写回"),
        tabButton(api.state, "audience", "受众"),
        tabButton(api.state, "alert", "告警"),
      ]) +
      '<span class="sec-govern-session">会话 <span class="sec-govern-session-id">' + esc(sessionLabel(api.ctx)) + "</span></span>" +
      "</div>";
  }

  function groupHTML(name, tabs) {
    return '<div class="sec-govern-group"><span class="sec-govern-group-name">' + name +
      '</span><div class="sec-govern-tabs" role="tablist">' + tabs.join("") + "</div></div>";
  }

  function tabButton(state, id, label) {
    var on = state.tab === id;
    return '<button type="button" class="sec-govern-tab' + (on ? " sec-govern-tab-active" : "") +
      '" role="tab" aria-selected="' + (on ? "true" : "false") + '" data-govern-tab="' + id + '">' +
      label + "</button>";
  }

  function formHTML(state) {
    var tab = state.tab;
    var pending = !!(state.view[tab] && state.view[tab].pending);
    if (tab === "assert") return assertForm(state.assert, pending);
    if (tab === "drift") return driftForm(state.drift, pending);
    if (tab === "sync") return syncForm(state.sync, pending);
    if (tab === "audience") return audienceForm(state.audience, pending);
    return alertForm(state.alert, pending);
  }

  function assertForm(model, pending) {
    var rules = model.rules.map(function (rule, index) {
      return ruleHTML(rule, index, model.rules.length);
    }).join("");
    return hint("对表运行 not_null、unique、between、row_count。") +
      field("表", "table", input("assert.table", model.table, 'placeholder="会话中的表名"')) +
      '<div class="sec-govern-field"><span class="sec-govern-label">规则 <span class="sec-govern-key">rules</span></span>' +
      rules + "</div>" +
      actions(pending, "运行断言", '<button type="button" class="sec-govern-btn" data-action="add-rule">添加规则</button>');
  }

  function ruleHTML(rule, index, total) {
    var extra = "";
    if (rule.type === "not_null" || rule.type === "unique") {
      extra = input("assert.rules." + index + ".column", rule.column, 'placeholder="列名"');
    } else if (rule.type === "between") {
      extra = input("assert.rules." + index + ".column", rule.column, 'placeholder="列名"') +
        '<div class="sec-govern-pair">' +
        input("assert.rules." + index + ".min_val", rule.min_val, 'placeholder="min_val" inputmode="decimal"') +
        input("assert.rules." + index + ".max_val", rule.max_val, 'placeholder="max_val" inputmode="decimal"') +
        "</div>";
    } else {
      extra = '<div class="sec-govern-pair">' +
        input("assert.rules." + index + ".min_rows", rule.min_rows, 'placeholder="min_rows" inputmode="numeric"') +
        input("assert.rules." + index + ".max_rows", rule.max_rows, 'placeholder="max_rows" inputmode="numeric"') +
        "</div>";
    }
    var remove = total > 1
      ? '<button type="button" class="sec-govern-btn" data-action="remove-rule" data-index="' + index + '">删除</button>'
      : "";
    return '<div class="sec-govern-rule"><div class="sec-govern-rule-top">' +
      select("assert.rules." + index + ".type", rule.type, RULE_TYPES, 'data-rerender="1"') +
      remove + "</div>" + extra + "</div>";
  }

  function driftForm(model, pending) {
    var rows = model.columns.map(function (col, index) {
      var remove = model.columns.length > 1
        ? '<button type="button" class="sec-govern-btn" data-action="remove-col" data-index="' + index + '">删除</button>'
        : "";
      return '<div class="sec-govern-inline">' +
        input("drift.columns." + index + ".name", col.name, 'placeholder="列名"') +
        input("drift.columns." + index + ".type", col.type, 'placeholder="INTEGER"') +
        remove + "</div>";
    }).join("");
    return hint("对照基线 schema，检查增列、缺列和类型变化。类型与 DESCRIBE 一致，如 INTEGER、VARCHAR、DOUBLE。") +
      field("表", "table", input("drift.table", model.table, 'placeholder="会话中的表名"')) +
      '<div class="sec-govern-field"><span class="sec-govern-label">基线 <span class="sec-govern-key">baseline_schema</span></span>' +
      rows + "</div>" +
      actions(pending, "检测漂移", '<button type="button" class="sec-govern-btn" data-action="add-col">添加列</button>');
  }

  function syncForm(model, pending) {
    return hint("把会话表写到 SQLite、PostgreSQL、MySQL，或 Parquet/CSV 文件。文件只支持 replace。") +
      field("源表", "source_table", input("sync.source_table", model.source_table, 'placeholder="会话中的表名"')) +
      field("目标连接", "dest_conn_str", input("sync.dest_conn_str", model.dest_conn_str, 'placeholder="sqlite:///data/export_sync.db"')) +
      field("目标表", "dest_table_name", input("sync.dest_table_name", model.dest_table_name, 'placeholder="synced_result"')) +
      field("模式", "mode", select("sync.mode", model.mode, MODES)) +
      field("批大小", "chunk_size", input("sync.chunk_size", model.chunk_size, 'inputmode="numeric"')) +
      hint("chunk_size 是数据库目的地的 Arrow 批大小，须为大于等于 1 的整数。") +
      actions(pending, "开始写回", "");
  }

  function audienceForm(model, pending) {
    return hint("按条件导出 JSON 或 CSV。") +
      field("源表", "source_table", input("audience.source_table", model.source_table, 'placeholder="会话中的表名"')) +
      field("过滤条件", "filter_sql", input("audience.filter_sql", model.filter_sql, 'placeholder="region = \'East\'，可空"')) +
      field("导出列", "export_columns", input("audience.export_columns", model.export_columns, 'placeholder="customer_id, sales，可空表示全部列"')) +
      field("格式", "format_type", select("audience.format_type", model.format_type, FORMATS)) +
      field("行数上限", "limit", input("audience.limit", model.limit, 'inputmode="numeric"')) +
      actions(pending, "导出受众", "");
  }

  function alertForm(model, pending) {
    return hint("飞书 post 卡片、钉钉 markdown、企业微信 markdown、Slack 文本，或其他值走通用 JSON。") +
      field("Webhook", "webhook_url", input("alert.webhook_url", model.webhook_url, 'placeholder="https://example.com/hook"')) +
      field("平台", "platform", select("alert.platform", model.platform, PLATFORMS)) +
      hint("企业微信也可传 wechat、weixin、qywx、wxwork、wechat_work，报文与 wecom 相同。") +
      field("标题", "title", input("alert.title", model.title, 'placeholder="标题"')) +
      field("正文", "message", '<textarea class="sec-govern-textarea" data-field="alert.message" placeholder="正文">' + esc(model.message) + "</textarea>") +
      field("附加指标", "extra_metrics", '<textarea class="sec-govern-textarea" data-field="alert.extra_metrics" placeholder=\'{"region":"East"}\'>' + esc(model.extra_metrics) + "</textarea>") +
      actions(pending, "发送告警", "");
  }

  function hint(text) {
    return '<p class="sec-govern-hint">' + text + "</p>";
  }

  function field(label, key, control) {
    return '<label class="sec-govern-field"><span class="sec-govern-label">' + label +
      ' <span class="sec-govern-key">' + key + "</span></span>" + control + "</label>";
  }

  function actions(pending, primary, extra) {
    return '<div class="sec-govern-actions">' + extra +
      '<button type="submit" class="sec-govern-btn sec-govern-btn-primary"' + (pending ? " disabled" : "") + ">" +
      (pending ? "提交中" : primary) + "</button></div>";
  }

  function input(path, value, extra) {
    return '<input class="sec-govern-input" data-field="' + path + '" value="' + esc(value) + '" ' + (extra || "") + ">";
  }

  function select(path, value, options, extra) {
    var opts = options.map(function (option) {
      var selected = option.value === value ? " selected" : "";
      return '<option value="' + esc(option.value) + '"' + selected + ">" + esc(option.label) + "</option>";
    }).join("");
    return '<select class="sec-govern-select" data-field="' + path + '" ' + (extra || "") + ">" + opts + "</select>";
  }

  function onClick(event, api) {
    readForm(api.root, api.state);
    var tab = event.target.closest && event.target.closest("[data-govern-tab]");
    if (tab && api.root.contains(tab)) {
      api.state.tab = tab.getAttribute("data-govern-tab");
      render(api);
      return;
    }
    var el = event.target.closest && event.target.closest("[data-action]");
    if (!el || !api.root.contains(el)) return;
    var action = el.getAttribute("data-action");
    if (action === "add-rule") {
      api.state.assert.rules.push(blankRule("not_null"));
      render(api);
    } else if (action === "remove-rule") {
      api.state.assert.rules.splice(Number(el.getAttribute("data-index")), 1);
      if (!api.state.assert.rules.length) api.state.assert.rules.push(blankRule("not_null"));
      render(api);
    } else if (action === "add-col") {
      api.state.drift.columns.push({ name: "", type: "" });
      render(api);
    } else if (action === "remove-col") {
      api.state.drift.columns.splice(Number(el.getAttribute("data-index")), 1);
      if (!api.state.drift.columns.length) api.state.drift.columns.push({ name: "", type: "" });
      render(api);
    }
  }

  function onField(event, api) {
    var el = event.target;
    if (!el || !el.getAttribute || !el.getAttribute("data-field")) return;
    setPath(api.state, el.getAttribute("data-field"), el.value);
    if (el.getAttribute("data-rerender") === "1") render(api);
  }

  function setPath(obj, path, value) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      cur = cur[partKey(parts[i])];
    }
    cur[partKey(parts[parts.length - 1])] = value;
  }

  function partKey(part) {
    return /^\d+$/.test(part) ? Number(part) : part;
  }

  function readForm(root, state) {
    var fields = root.querySelectorAll("[data-field]");
    for (var i = 0; i < fields.length; i++) {
      setPath(state, fields[i].getAttribute("data-field"), fields[i].value);
    }
  }

  function submit(api) {
    readForm(api.root, api.state);
    var tab = api.state.tab;
    var built;
    try {
      built = build(api.state, api.ctx, tab);
    } catch (err) {
      api.state.view[tab] = { error: err.message || "无法提交", source: "client" };
      render(api);
      return;
    }
    var token = (api.state.token[tab] || 0) + 1;
    api.state.token[tab] = token;
    api.state.view[tab] = { pending: true };
    render(api);
    callApi(api.ctx, "POST", built.path, built.body).then(function (res) {
      if (api.state.token[tab] !== token) return;
      if (!res.ok) {
        api.state.view[tab] = { error: res.detail, source: "api" };
        notify(api.ctx, res.detail);
      } else {
        api.state.view[tab] = { data: res.data, sent: built.body };
        notify(api.ctx, successText(tab, res.data));
      }
      render(api);
    });
  }

  function build(state, ctx, tab) {
    if (tab === "assert") return { path: "/api/v1/observability/assert", body: assertBody(state, ctx) };
    if (tab === "drift") return { path: "/api/v1/observability/drift", body: driftBody(state, ctx) };
    if (tab === "sync") return { path: "/api/v1/retl/sync", body: syncBody(state, ctx) };
    if (tab === "audience") return { path: "/api/v1/retl/audience", body: audienceBody(state, ctx) };
    if (tab === "alert") return { path: "/api/v1/retl/alert", body: alertBody(state) };
    throw new Error("未知面板");
  }

  function assertBody(state, ctx) {
    var table = required(state.assert.table, "请填写表名");
    if (!state.assert.rules.length) throw new Error("请至少添加一条规则");
    return {
      session_id: currentSession(ctx),
      table: table,
      rules: state.assert.rules.map(function (rule, index) { return ruleBody(rule, index); }),
    };
  }

  function ruleBody(rule, index) {
    var nth = "第 " + (index + 1) + " 条规则";
    if (rule.type === "not_null" || rule.type === "unique") {
      return { type: rule.type, column: required(rule.column, nth + "缺少列名") };
    }
    if (rule.type === "between") {
      return {
        type: "between",
        column: required(rule.column, nth + "缺少列名"),
        min_val: parseNumber(rule.min_val, nth + "的 min_val"),
        max_val: parseNumber(rule.max_val, nth + "的 max_val"),
      };
    }
    if (rule.type === "row_count") {
      return {
        type: "row_count",
        min_rows: parseCount(rule.min_rows, nth + "的 min_rows", true),
        max_rows: parseCount(rule.max_rows, nth + "的 max_rows", true),
      };
    }
    throw new Error(nth + "类型不受支持");
  }

  function driftBody(state, ctx) {
    var schema = {};
    state.drift.columns.forEach(function (col, index) {
      var name = String(col.name || "").trim();
      var type = String(col.type || "").trim();
      if (!name && !type) return;
      if (!name || !type) throw new Error("第 " + (index + 1) + " 列需要列名和类型");
      if (Object.prototype.hasOwnProperty.call(schema, name)) throw new Error("列名重复：" + name);
      schema[name] = type;
    });
    if (!Object.keys(schema).length) throw new Error("请至少填写一列基线");
    return {
      session_id: currentSession(ctx),
      table: required(state.drift.table, "请填写表名"),
      baseline_schema: schema,
    };
  }

  function syncBody(state, ctx) {
    return {
      session_id: currentSession(ctx),
      source_table: required(state.sync.source_table, "请填写源表"),
      dest_conn_str: required(state.sync.dest_conn_str, "请填写目标连接"),
      dest_table_name: required(state.sync.dest_table_name, "请填写目标表"),
      mode: state.sync.mode === "append" ? "append" : "replace",
      chunk_size: parseCount(state.sync.chunk_size, "chunk_size", false),
    };
  }

  function audienceBody(state, ctx) {
    var body = {
      session_id: currentSession(ctx),
      source_table: required(state.audience.source_table, "请填写源表"),
      format_type: state.audience.format_type === "csv" ? "csv" : "json",
      limit: parseCount(state.audience.limit, "limit", false),
    };
    var filter = String(state.audience.filter_sql || "").trim();
    if (filter) body.filter_sql = filter;
    var columns = String(state.audience.export_columns || "").split(/[,，]/).map(function (item) {
      return item.trim();
    }).filter(Boolean);
    if (columns.length) body.export_columns = columns;
    return body;
  }

  function alertBody(state) {
    var body = {
      webhook_url: required(state.alert.webhook_url, "请填写 webhook_url"),
      title: required(state.alert.title, "请填写标题"),
      message: required(state.alert.message, "请填写正文"),
      platform: state.alert.platform || "generic",
    };
    var raw = String(state.alert.extra_metrics || "").trim();
    if (!raw) return body;
    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error("附加指标不是合法 JSON");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("附加指标须为 JSON 对象");
    }
    body.extra_metrics = parsed;
    return body;
  }

  function required(value, message) {
    var text = String(value == null ? "" : value).trim();
    if (!text) throw new Error(message);
    return text;
  }

  function parseNumber(value, name) {
    var text = String(value == null ? "" : value).trim();
    if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(text)) throw new Error(name + "须为数字");
    var num = Number(text);
    if (!Number.isFinite(num)) throw new Error(name + "须为数字");
    return num;
  }

  function parseCount(value, name, allowZero) {
    var text = String(value == null ? "" : value).trim();
    if (!/^\d+$/.test(text)) throw new Error(name + "须为" + (allowZero ? "大于等于 0" : "大于等于 1") + "的整数");
    var num = Number(text);
    if (!Number.isSafeInteger(num) || num < (allowZero ? 0 : 1)) {
      throw new Error(name + "须为" + (allowZero ? "大于等于 0" : "大于等于 1") + "的整数");
    }
    return num;
  }

  function currentSession(ctx) {
    if (!ctx || typeof ctx.sessionId !== "function") throw new Error("缺少 session_id");
    var id = ctx.sessionId();
    var text = id == null ? "" : String(id).trim();
    if (!text) throw new Error("缺少 session_id");
    return text;
  }

  function sessionLabel(ctx) {
    try {
      return currentSession(ctx);
    } catch (err) {
      return "—";
    }
  }

  function callApi(ctx, method, path, body) {
    if (!ctx || typeof ctx.api !== "function") {
      return Promise.resolve({ ok: false, detail: "缺少 ctx.api" });
    }
    return Promise.resolve()
      .then(function () { return ctx.api(method, path, body); })
      .then(function (data) {
        if (looksLikeErrorBody(data)) return { ok: false, detail: formatDetail(data.detail) };
        return { ok: true, data: data };
      })
      .catch(function (err) { return { ok: false, detail: detailOf(err) }; });
  }

  function looksLikeErrorBody(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || !("detail" in data)) return false;
    if (data.status === "error") return true;
    var keys = Object.keys(data);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== "detail" && keys[i] !== "status" && keys[i] !== "request_id" && keys[i] !== "message") {
        return false;
      }
    }
    return true;
  }

  function detailOf(err) {
    if (err == null) return "请求失败";
    if (typeof err === "string") return unwrapMessage(err);
    if (Object.prototype.hasOwnProperty.call(err, "detail")) return formatDetail(err.detail);
    var bags = [err.data, err.body, err.payload, err.response];
    for (var i = 0; i < bags.length; i++) {
      if (bags[i] && typeof bags[i] === "object" && "detail" in bags[i]) return formatDetail(bags[i].detail);
    }
    if (typeof err.message === "string" && err.message) return unwrapMessage(err.message);
    return "请求失败";
  }

  function unwrapMessage(text) {
    var trimmed = String(text).trim();
    if (!trimmed) return "请求失败";
    if (trimmed.charAt(0) === "{" || trimmed.charAt(0) === "[") {
      try {
        var parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "detail" in parsed) {
          return formatDetail(parsed.detail);
        }
        if (Array.isArray(parsed)) return formatDetail(parsed);
      } catch (err) { /* 保留原文 */ }
    }
    return trimmed;
  }

  function formatDetail(detail) {
    if (detail == null) return "请求失败";
    if (typeof detail === "string") return detail;
    if (typeof detail === "number" || typeof detail === "boolean") return String(detail);
    if (Array.isArray(detail)) {
      if (!detail.length) return "请求失败";
      return detail.map(formatDetailItem).join("\n");
    }
    if (typeof detail === "object") {
      if (typeof detail.msg === "string" || typeof detail.message === "string") return formatDetailItem(detail);
      try { return JSON.stringify(detail, null, 2); } catch (err) { return "请求失败"; }
    }
    return String(detail);
  }

  function formatDetailItem(item) {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return String(item);
    var msg = item.msg || item.message || "";
    var loc = Array.isArray(item.loc) ? item.loc.filter(function (part) { return part !== "body"; }).join(".") : "";
    if (loc && msg) return loc + "：" + msg;
    if (msg) return msg;
    try { return JSON.stringify(item); } catch (err) { return "请求失败"; }
  }

  function notify(ctx, text) {
    if (!ctx || typeof ctx.notify !== "function") return;
    try { ctx.notify(String(text)); } catch (err) { /* 通知失败不影响结果区 */ }
  }

  function successText(tab, data) {
    if (tab === "assert") return "断言完成";
    if (tab === "drift") return "漂移检测完成";
    if (tab === "sync") return "写回完成";
    if (tab === "audience") return "受众已导出";
    if (data && data.status === "FAILED") return "告警返回 FAILED";
    return "告警已发送";
  }

  function renderResult(host, state) {
    var view = state.view[state.tab];
    host.textContent = "";
    if (!view) {
      host.appendChild(el("p", "sec-govern-muted", "尚未运行。"));
      return;
    }
    if (view.pending) {
      host.appendChild(el("p", "sec-govern-muted", "提交中…"));
      return;
    }
    if (view.error) {
      var box = el("div", "sec-govern-error");
      box.appendChild(el("div", "sec-govern-error-label", view.source === "api" ? "返回详情" : "无法提交"));
      var pre = el("pre", "sec-govern-pre");
      pre.textContent = view.error;
      box.appendChild(pre);
      host.appendChild(box);
      return;
    }
    var data = view.data || {};
    if (state.tab === "assert") host.appendChild(renderAssert(data));
    else if (state.tab === "drift") host.appendChild(renderDrift(data));
    else if (state.tab === "sync") host.appendChild(renderSync(data, view.sent));
    else if (state.tab === "audience") host.appendChild(renderAudience(data));
    else host.appendChild(renderAlert(data, view.sent));
    host.appendChild(rawBlock(data));
  }

  function renderAssert(data) {
    var wrap = el("div", null);
    wrap.appendChild(stats([
      { label: "data_health_score", value: show(data.data_health_score) },
      { label: "passed_assertions", value: show(data.passed_assertions) },
      { label: "failed_assertions", value: show(data.failed_assertions), tone: data.failed_assertions ? "bad" : undefined },
      { label: "all_passed", value: show(data.all_passed), tone: boolTone(data.all_passed, false) },
    ]));
    var rows = (data.assertion_results || []).map(function (item) {
      return [
        show(item.assertion || item.rule_type),
        show(item.column),
        item.passed === true ? "通过" : item.passed === false ? "未通过" : "—",
        show(item.unexpected_count),
        show(item.actual_rows != null ? item.actual_rows : item.total_records),
        show(item.message),
      ];
    });
    wrap.appendChild(dataTable(["assertion", "column", "结果", "unexpected_count", "rows", "message"], rows));
    return wrap;
  }

  function renderDrift(data) {
    var wrap = el("div", null);
    wrap.appendChild(stats([
      { label: "has_drift", value: show(data.has_drift), tone: boolTone(data.has_drift, true) },
      { label: "added_columns_count", value: show(data.added_columns_count) },
      { label: "removed_columns_count", value: show(data.removed_columns_count) },
      { label: "type_mismatches_count", value: show(data.type_mismatches_count) },
    ]));
    wrap.appendChild(namedTable("added_columns", ["column", "type"], (data.added_columns || []).map(function (item) {
      return [show(item.column), show(item.type)];
    })));
    wrap.appendChild(namedTable("removed_columns", ["column", "type"], (data.removed_columns || []).map(function (item) {
      return [show(item.column), show(item.type)];
    })));
    wrap.appendChild(namedTable("type_mismatches", ["column", "expected_type", "actual_type"], (data.type_mismatches || []).map(function (item) {
      return [show(item.column), show(item.expected_type), show(item.actual_type)];
    })));
    return wrap;
  }

  function renderSync(data, sent) {
    var wrap = el("div", null);
    wrap.appendChild(stats([
      { label: "status", value: show(data.status), tone: data.status == null ? undefined : data.status === "SUCCESS" ? "ok" : "bad" },
      { label: "synced_rows", value: show(data.synced_rows) },
      { label: "mode", value: show(data.mode) },
      { label: "chunk_size", value: show(sent && sent.chunk_size) },
    ]));
    wrap.appendChild(el("p", "sec-govern-muted", "chunk_size 为本次请求值。响应字段：dest_table_name " +
      show(data.dest_table_name) + "，duration_ms " + show(data.duration_ms) + "。"));
    return wrap;
  }

  function renderAudience(data) {
    var wrap = el("div", null);
    wrap.appendChild(stats([
      { label: "total_audience_count", value: show(data.total_audience_count) },
      { label: "exported_count", value: show(data.exported_count) },
      { label: "truncated", value: show(data.truncated), tone: boolTone(data.truncated, true) },
    ]));
    wrap.appendChild(el("p", "sec-govern-muted", "format " + show(data.format) + " · source_table " + show(data.source_table)));
    wrap.appendChild(renderAudienceData(data.data, data.exported_count));
    return wrap;
  }

  function renderAudienceData(data, exported) {
    var block = el("div", "sec-govern-block");
    block.appendChild(el("p", "sec-govern-block-title", "data"));
    if (typeof data === "string") {
      var pre = el("pre", "sec-govern-pre");
      pre.textContent = data.length > 4000 ? data.slice(0, 4000) + "\n…（已截断显示）" : data;
      block.appendChild(pre);
      return block;
    }
    if (Array.isArray(data)) {
      var shown = data.slice(0, 20);
      var keys = [];
      shown.forEach(function (row) {
        if (!row || typeof row !== "object") return;
        Object.keys(row).forEach(function (key) {
          if (keys.indexOf(key) === -1) keys.push(key);
        });
      });
      var rows = shown.map(function (row) {
        if (!row || typeof row !== "object") return [show(row)];
        return keys.map(function (key) { return show(row[key]); });
      });
      block.appendChild(dataTable(keys.length ? keys : ["value"], rows));
      if (data.length > shown.length) {
        block.appendChild(el("p", "sec-govern-muted", "仅展示前 " + shown.length + " 行，exported_count 为 " + show(exported) + "。"));
      }
      return block;
    }
    block.appendChild(jsonPre(data));
    return block;
  }

  function renderAlert(data, sent) {
    var wrap = el("div", null);
    var failed = data.status === "FAILED";
    wrap.appendChild(stats([
      { label: "status", value: show(data.status), tone: data.status == null ? undefined : failed ? "bad" : "ok" },
      { label: "platform", value: show(sent && sent.platform) },
      { label: "http_code", value: show(data.http_code) },
      { label: "attempts", value: show(data.attempts) },
    ]));
    if (data.error) wrap.appendChild(el("p", "sec-govern-muted", String(data.error)));
    if (data.simulated_payload) {
      var block = el("div", "sec-govern-block");
      block.appendChild(el("p", "sec-govern-block-title", "simulated_payload"));
      block.appendChild(jsonPre(data.simulated_payload));
      wrap.appendChild(block);
    }
    return wrap;
  }

  function namedTable(title, headers, rows) {
    var block = el("div", "sec-govern-block");
    block.appendChild(el("p", "sec-govern-block-title", title));
    if (!rows.length) {
      block.appendChild(el("p", "sec-govern-muted", "无"));
      return block;
    }
    block.appendChild(dataTable(headers, rows));
    return block;
  }

  function stats(items) {
    var wrap = el("div", "sec-govern-stats");
    items.forEach(function (item) {
      var cell = el("div", "sec-govern-stat");
      cell.appendChild(el("div", "sec-govern-stat-label", item.label));
      var value = el("div", "sec-govern-stat-value" + (item.tone ? " sec-govern-tone-" + item.tone : ""), item.value);
      cell.appendChild(value);
      wrap.appendChild(cell);
    });
    return wrap;
  }

  function dataTable(headers, rows) {
    var wrap = el("div", "sec-govern-table-wrap");
    var table = el("table", "sec-govern-table");
    var thead = document.createElement("thead");
    var headRow = document.createElement("tr");
    headers.forEach(function (header) { headRow.appendChild(el("th", null, header)); });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var body = document.createElement("tbody");
    if (!rows.length) {
      var empty = document.createElement("tr");
      var cell = el("td", null, "无");
      cell.colSpan = headers.length || 1;
      empty.appendChild(cell);
      body.appendChild(empty);
    } else {
      rows.forEach(function (row) {
        var tr = document.createElement("tr");
        row.forEach(function (cellText) { tr.appendChild(el("td", null, cellText)); });
        body.appendChild(tr);
      });
    }
    table.appendChild(body);
    wrap.appendChild(table);
    return wrap;
  }

  function rawBlock(data) {
    var details = el("details", "sec-govern-raw");
    details.appendChild(el("summary", "sec-govern-summary", "原始响应"));
    details.appendChild(jsonPre(data));
    return details;
  }

  function jsonPre(data) {
    var pre = el("pre", "sec-govern-pre");
    try { pre.textContent = JSON.stringify(data, null, 2); }
    catch (err) { pre.textContent = String(data); }
    return pre;
  }

  function boolTone(value, badWhenTrue) {
    if (typeof value !== "boolean") return undefined;
    var bad = badWhenTrue ? value : !value;
    return bad ? "bad" : "ok";
  }

  function show(value) {
    if (value == null || value === "") return "—";
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
})();
