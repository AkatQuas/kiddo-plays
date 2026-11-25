/* 数据段：导入文件、连接数据库、导入 Trace。
 * 只调用已有接口：
 *   POST /api/v1/import/file   （multipart：file / file_path / dataset_name / session_id / sheet_name / limit）
 *   POST /api/v1/connect       （JSON：ConnectDBRequest）
 *   POST /api/v1/import/traces （JSON：TraceImportRequest）
 * 本文件在壳层之前加载时只注册 window.DashboardSections.ingest。
 */
(function () {
  "use strict";

  window.DashboardSections = window.DashboardSections || {};

  var SAMPLE_TRACES = [
    { event_name: "$pageview", event_type: "pageview", user_id: "u1", session_id: "s1", trace_id: "t1", span_id: "a1", page_path: "/home", timestamp_ms: 1 },
    { event_name: "view_item", event_type: "custom", user_id: "u1", session_id: "s1", trace_id: "t1", span_id: "a2", parent_span_id: "a1", page_path: "/product", timestamp_ms: 2, duration_ms: 120 },
    { event_name: "add_to_cart", event_type: "custom", user_id: "u1", session_id: "s1", trace_id: "t1", span_id: "a3", parent_span_id: "a2", page_path: "/cart", timestamp_ms: 3, duration_ms: 80 },
    { event_name: "purchase_success", event_type: "custom", user_id: "u1", session_id: "s1", trace_id: "t1", span_id: "a4", parent_span_id: "a3", page_path: "/success", timestamp_ms: 4, duration_ms: 200 },
    { event_name: "$pageview", event_type: "pageview", user_id: "u2", session_id: "s2", trace_id: "t2", span_id: "b1", page_path: "/home", timestamp_ms: 1 },
    { event_name: "view_item", event_type: "custom", user_id: "u2", session_id: "s2", trace_id: "t2", span_id: "b2", parent_span_id: "b1", page_path: "/product", timestamp_ms: 2, duration_ms: 90 },
    { event_name: "add_to_cart", event_type: "custom", user_id: "u2", session_id: "s2", trace_id: "t2", span_id: "b3", parent_span_id: "b2", page_path: "/cart", timestamp_ms: 3, duration_ms: 75 },
    { event_name: "$error", event_type: "error", user_id: "u3", session_id: "s3", trace_id: "t3", span_id: "c1", page_path: "/cart", timestamp_ms: 1, properties: { message: "NullPointer" } }
  ];

  var STYLE_ID = "sec-ingest-style";

  var SERIF = '"Cormorant Garamond","Noto Serif SC","Songti SC",serif';
  var SANS = '"Outfit","PingFang SC","Noto Sans SC",sans-serif';
  var LINE = "rgba(243,239,230,0.12)";

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      "#mount .sec-ingest-root{background:transparent;color:#f4f0e6;font-family:" + SANS + ";font-size:15px;font-weight:400;line-height:1.5;border:0;border-radius:0;padding:4px 0 8px;}",
      "#mount .sec-ingest-root *{box-sizing:border-box;}",
      "#mount .sec-ingest-root [hidden]{display:none !important;}",
      "#mount .sec-ingest-tabs{display:flex;gap:36px;margin:0;background:transparent;border:0;border-bottom:1px solid " + LINE + ";}",
      "#mount .sec-ingest-root button.sec-ingest-tab{appearance:none;background:transparent;border:0;border-bottom:1px solid transparent;border-radius:0;margin:0 0 -1px;padding:0 0 14px;color:#a39b8e;cursor:pointer;font-family:" + SANS + ";font-size:13px;font-weight:400;letter-spacing:0.18em;}",
      "#mount .sec-ingest-root button.sec-ingest-tab-active{color:#c6a15b;border-bottom-color:#c6a15b;font-weight:500;background:transparent;}",
      "#mount .sec-ingest-panel-hint{margin:40px 0 52px;max-width:18em;color:#f4f0e6;font-family:" + SERIF + ";font-size:32px;font-weight:500;line-height:1.3;letter-spacing:0.01em;}",
      "#mount .sec-ingest-layout{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,0.8fr);gap:80px;align-items:start;}",
      "#mount .sec-ingest-form{background:transparent;border:0;border-radius:0;padding:0;box-shadow:none;}",
      "#mount .sec-ingest-result{background:#161410;color:#f4f0e6;border:0;border-radius:0;box-shadow:none;padding:36px 32px 40px;}",
      "#mount .sec-ingest-field{margin:0 0 30px;}",
      "#mount .sec-ingest-label{display:block;margin:0 0 2px;color:#a39b8e;font-family:" + SANS + ";font-size:11px;font-weight:400;letter-spacing:0.22em;}",
      "#mount .sec-ingest-root input.sec-ingest-input,#mount .sec-ingest-root select.sec-ingest-select{width:100%;margin:0;background-color:transparent;color:#f4f0e6;border:0;border-bottom:1px solid " + LINE + ";border-radius:0;box-shadow:none;padding:8px 0 10px;font-family:" + SANS + ";font-size:16px;font-weight:300;letter-spacing:0.02em;}",
      "#mount .sec-ingest-root select.sec-ingest-select{appearance:none;padding-right:22px;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2 4.5 L6 8 L10 4.5' fill='none' stroke='%23a39b8e' stroke-width='1'/%3E%3C/svg%3E\");background-repeat:no-repeat;background-position:right center;background-size:12px 12px;}",
      "#mount .sec-ingest-root select.sec-ingest-select option{background:#161410;color:#f4f0e6;}",
      "#mount .sec-ingest-root input.sec-ingest-input::placeholder{color:#a39b8e;opacity:1;font-weight:300;}",
      "#mount .sec-ingest-root input.sec-ingest-input:focus,#mount .sec-ingest-root select.sec-ingest-select:focus{outline:none;border-bottom-color:rgba(244,240,230,0.72);}",
      "#mount .sec-ingest-root input.sec-ingest-input:-webkit-autofill{ -webkit-text-fill-color:#f4f0e6;caret-color:#f4f0e6;box-shadow:0 0 0 1000px #0e0d0b inset;}",
      "#mount .sec-ingest-filepick{display:flex;align-items:baseline;gap:22px;min-width:0;border-bottom:1px solid " + LINE + ";padding:10px 0;background:transparent;}",
      "#mount .sec-ingest-root button.sec-ingest-filepick-btn{appearance:none;background:transparent;color:#f4f0e6;border:0;border-radius:0;padding:0;cursor:pointer;font-family:" + SANS + ";font-size:14px;font-weight:400;letter-spacing:0.16em;}",
      "#mount .sec-ingest-filepick-name{color:#a39b8e;letter-spacing:0.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}",
      "#mount .sec-ingest-file-input{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0;}",
      "#mount .sec-ingest-mono{font-family:" + SANS + ";font-weight:300;}",
      "#mount .sec-ingest-hint{margin:8px 0 0;color:#a39b8e;font-size:12px;font-weight:400;letter-spacing:0.04em;line-height:1.55;}",
      "#mount .sec-ingest-actions{display:flex;align-items:center;gap:28px;margin-top:8px;background:transparent;border:0;}",
      "#mount .sec-ingest-root button.sec-ingest-submit{appearance:none;background:#c6a15b;color:#0e0d0b;border:0;border-radius:0;padding:12px 22px;cursor:pointer;font-family:" + SANS + ";font-size:13px;font-weight:500;letter-spacing:0.2em;}",
      "#mount .sec-ingest-root button.sec-ingest-submit:hover{filter:brightness(1.08);}",
      "#mount .sec-ingest-root button.sec-ingest-submit:disabled{opacity:.4;cursor:default;filter:none;}",
      "#mount .sec-ingest-root button.sec-ingest-textbtn{appearance:none;background:transparent;border:0;border-radius:0;padding:12px 0;color:#a39b8e;text-decoration:none;cursor:pointer;font-family:" + SANS + ";font-size:13px;font-weight:400;letter-spacing:0.14em;}",
      "#mount .sec-ingest-root button.sec-ingest-textbtn:hover{color:#f4f0e6;}",
      "#mount .sec-ingest-root button.sec-ingest-textbtn:disabled{opacity:.4;cursor:default;}",
      "#mount .sec-ingest-result-title{margin:0 0 28px;color:#f4f0e6;font-family:" + SERIF + ";font-size:40px;font-weight:500;line-height:1;letter-spacing:0.02em;}",
      "#mount .sec-ingest-lead{margin:0 0 12px;color:#f4f0e6;font-family:" + SERIF + ";font-size:26px;font-weight:500;line-height:1.35;}",
      "#mount .sec-ingest-out{margin:0;min-height:0;white-space:pre-wrap;word-break:break-word;background:transparent;color:#a39b8e;font-family:" + SANS + ";font-size:14px;font-weight:400;letter-spacing:0.08em;line-height:1.6;}",
      "#mount .sec-ingest-out-ok{color:#f4f0e6;}",
      "#mount .sec-ingest-out-error{color:#c47a6a;}",
      "#mount .sec-ingest-cols,#mount .sec-ingest-summary{margin:18px 0 0;color:#a39b8e;font-size:13px;font-weight:400;letter-spacing:0.08em;line-height:1.6;}",
      "#mount .sec-ingest-root table.sec-ingest-table{width:100%;border-collapse:collapse;margin:8px 0 0;background:transparent;font-family:" + SANS + ";font-size:15px;font-weight:400;letter-spacing:0.14em;color:#f4f0e6;}",
      "#mount .sec-ingest-root table.sec-ingest-table th,#mount .sec-ingest-root table.sec-ingest-table td{border:0;border-bottom:1px solid " + LINE + ";background:transparent;padding:16px 0;text-align:left;vertical-align:baseline;font-weight:400;color:#f4f0e6;letter-spacing:0.14em;}",
      "#mount .sec-ingest-root table.sec-ingest-table th{color:#a39b8e;font-size:12px;font-weight:400;letter-spacing:0.2em;width:46%;}",
      "#mount .sec-ingest-root table.sec-ingest-table td.sec-ingest-num{text-align:right;font-variant-numeric:tabular-nums lining-nums;font-feature-settings:\"tnum\" 1,\"lnum\" 1;letter-spacing:0.12em;}",
      "#mount .sec-ingest-root button.sec-ingest-tab:focus-visible,#mount .sec-ingest-root button.sec-ingest-submit:focus-visible,#mount .sec-ingest-root button.sec-ingest-textbtn:focus-visible,#mount .sec-ingest-root button.sec-ingest-filepick-btn:focus-visible{outline:1px solid rgba(244,240,230,0.55);outline-offset:3px;}",
      "@media (max-width:760px){#mount .sec-ingest-layout{grid-template-columns:minmax(0,1fr);gap:40px;}#mount .sec-ingest-panel-hint{font-size:26px;margin:28px 0 36px;}#mount .sec-ingest-result{padding:28px 22px 32px;}#mount .sec-ingest-result-title{font-size:32px;}}"
    ].join("");
    (document.head || document.documentElement).appendChild(style);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function formatDetail(detail) {
    if (detail == null || detail === "") return "";
    if (typeof detail === "string") return detail;
    try {
      return JSON.stringify(detail, null, 2);
    } catch (err) {
      return String(detail);
    }
  }

  function pickDetail(err) {
    if (!err || typeof err !== "object") return null;
    if (err.detail != null && err.detail !== "") return err.detail;
    var bags = [err.body, err.data, err.response, err.payload];
    for (var i = 0; i < bags.length; i += 1) {
      var bag = bags[i];
      if (bag && bag.detail != null && bag.detail !== "") return bag.detail;
    }
    return null;
  }

  function messageOf(err) {
    var detail = pickDetail(err);
    if (detail != null) {
      var text = formatDetail(detail);
      var reqId = err.request_id
        || (err.body && err.body.request_id)
        || (err.data && err.data.request_id);
      if (reqId && text.indexOf(String(reqId)) === -1) text += "\nrequest_id: " + reqId;
      return text;
    }
    if (err && err.message) return String(err.message);
    if (typeof err === "string") return err;
    return formatDetail(err) || "请求失败";
  }

  function clearRich(box) {
    if (!box) return;
    var nodes = box.querySelectorAll(".sec-ingest-lead,.sec-ingest-table,.sec-ingest-cols,.sec-ingest-summary");
    for (var i = 0; i < nodes.length; i += 1) nodes[i].remove();
  }

  function show(out, text, state) {
    var box = out.parentNode;
    if (box && box.classList && box.classList.contains("sec-ingest-result")) clearRich(box);
    out.hidden = false;
    out.textContent = text;
    out.classList.remove("sec-ingest-out-ok", "sec-ingest-out-error");
    if (state === "ok") out.classList.add("sec-ingest-out-ok");
    if (state === "error") out.classList.add("sec-ingest-out-error");
  }

  function sessionIdOf(ctx) {
    if (!ctx || typeof ctx.sessionId !== "function") return "";
    var id = ctx.sessionId();
    return id == null ? "" : String(id).trim();
  }

  function safeNotify(ctx, text) {
    if (!ctx || typeof ctx.notify !== "function") return;
    try {
      ctx.notify(text);
    } catch (err) {
      /* 通知失败不影响结果区里的接口内容 */
    }
  }

  function read(form, name) {
    var node = form.elements[name];
    if (!node) return "";
    return String(node.value == null ? "" : node.value).trim();
  }

  function optionalInt(raw) {
    if (raw == null || String(raw).trim() === "") return { ok: true, value: null };
    var s = String(raw).trim();
    if (!/^-?\d+$/.test(s)) return { ok: false, value: null };
    return { ok: true, value: parseInt(s, 10) };
  }

  function splitCols(raw) {
    if (!raw) return [];
    return String(raw).split(/[,，]/).map(function (part) {
      return part.trim();
    }).filter(Boolean);
  }

  function asList(value) {
    return Array.isArray(value) ? value : null;
  }

  function datasetInfo(data, fallback) {
    var meta = data && data.metadata ? data.metadata : {};
    var columns = asList(data && data.columns) || asList(meta.columns);
    var cols = data && data.column_count != null
      ? data.column_count
      : (columns ? columns.length : null);
    return {
      name: (data && data.dataset_name) || fallback.name,
      sessionId: (data && data.session_id) || fallback.sessionId,
      rows: data && data.row_count != null ? data.row_count : meta.row_count,
      cols: cols,
      columns: columns,
      memory: data && data.memory_bytes != null ? data.memory_bytes : meta.memory_bytes,
      summary: (data && (data.summary || data.summary_text)) || ""
    };
  }

  function addMetric(tbody, label, value) {
    if (value == null || value === "") return false;
    var tr = el("tr");
    var th = el("th");
    th.scope = "row";
    th.textContent = label;
    var td = el("td", "sec-ingest-num");
    td.textContent = String(value);
    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
    return true;
  }

  function presentOk(out, data, fallback) {
    var info = datasetInfo(data, fallback);
    var box = out.parentNode;
    clearRich(box);
    out.hidden = true;
    out.textContent = "";
    out.classList.remove("sec-ingest-out-ok", "sec-ingest-out-error");
    var lead = el("p", "sec-ingest-lead");
    var sid = info.sessionId ? String(info.sessionId) : "";
    lead.textContent = "数据集「" + (info.name || "") + "」已进入当前会话" + (sid ? " " + sid : "") + "。";
    box.appendChild(lead);
    var reportLink = el("a", "sec-ingest-report-link");
    reportLink.href = "#report";
    reportLink.textContent = "用这份数据生成分析报告 →";
    reportLink.addEventListener("click", function () {
      try { sessionStorage.setItem("das.report.dataset", info.name || ""); sessionStorage.setItem("das.report.auto", "1"); } catch (_) {}
    });
    box.appendChild(reportLink);
    var tbody = el("tbody");
    var any = false;
    if (addMetric(tbody, "行", info.rows)) any = true;
    if (addMetric(tbody, "列", info.cols)) any = true;
    if (addMetric(tbody, "内存（字节）", info.memory)) any = true;
    if (any) {
      var table = el("table", "sec-ingest-table");
      table.appendChild(tbody);
      box.appendChild(table);
    }
    var cols = asList(info.columns);
    if (cols && cols.length) {
      var colLine = el("p", "sec-ingest-cols");
      colLine.textContent = "列：" + cols.join("、");
      box.appendChild(colLine);
    }
    if (info.summary) {
      var summary = el("p", "sec-ingest-summary");
      summary.textContent = String(info.summary);
      box.appendChild(summary);
    }
  }

  function setBusy(form, busy) {
    var buttons = form.querySelectorAll("button");
    for (var i = 0; i < buttons.length; i += 1) buttons[i].disabled = busy;
  }

  function field(labelText, control, hintText) {
    var wrap = el("div", "sec-ingest-field");
    var label = el("label", "sec-ingest-label");
    var id = "sec-ingest-f-" + Math.random().toString(36).slice(2, 9);
    control.id = id;
    label.htmlFor = id;
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(control);
    if (hintText) {
      var hint = el("p", "sec-ingest-hint");
      hint.textContent = hintText;
      wrap.appendChild(hint);
    }
    return wrap;
  }

  function textInput(name, value, placeholder, mono) {
    var node = el("input", "sec-ingest-input" + (mono ? " sec-ingest-mono" : ""));
    node.type = "text";
    node.name = name;
    if (name === "limit" || name === "num_partitions") node.inputMode = "numeric";
    node.autocomplete = "off";
    node.spellcheck = false;
    if (value != null) node.value = value;
    if (placeholder) node.placeholder = placeholder;
    return node;
  }

  function fileInput(name, accept) {
    var pick = el("div", "sec-ingest-filepick");
    var button = el("button", "sec-ingest-filepick-btn");
    button.type = "button";
    button.textContent = "选择文件";
    var node = el("input", "sec-ingest-file-input");
    node.type = "file";
    node.name = name;
    if (accept) node.accept = accept;
    var nameEl = el("span", "sec-ingest-filepick-name");
    nameEl.textContent = "未选择文件";
    button.addEventListener("click", function () { node.click(); });
    node.addEventListener("change", function () {
      var file = node.files && node.files[0];
      nameEl.textContent = file ? file.name : "未选择文件";
    });
    pick.appendChild(button);
    pick.appendChild(node);
    pick.appendChild(nameEl);
    return pick;
  }

  function selectInput(name, options) {
    var node = el("select", "sec-ingest-select");
    node.name = name;
    options.forEach(function (opt) {
      var option = el("option");
      option.value = opt.value;
      option.textContent = opt.label;
      node.appendChild(option);
    });
    return node;
  }

  function resultBox() {
    var box = el("div", "sec-ingest-result");
    var title = el("div", "sec-ingest-result-title");
    title.textContent = "结果";
    var out = el("pre", "sec-ingest-out");
    out.textContent = "等待提交";
    box.appendChild(title);
    box.appendChild(out);
    return { box: box, out: out };
  }

  function shell(hintText, form, result) {
    var node = el("section", "sec-ingest-panel");
    var hint = el("p", "sec-ingest-panel-hint");
    hint.textContent = hintText;
    var row = el("div", "sec-ingest-layout");
    row.appendChild(form);
    row.appendChild(result.box);
    node.appendChild(hint);
    node.appendChild(row);
    return node;
  }

  function makeForm() {
    var form = el("form", "sec-ingest-form");
    form.method = "post";
    form.action = "about:blank";
    form.noValidate = true;
    return form;
  }

  function primary(label) {
    var button = el("button", "sec-ingest-submit");
    button.type = "submit";
    button.textContent = label;
    return button;
  }

  async function postJson(ctx, path, body) {
    if (!ctx || typeof ctx.api !== "function") {
      var missing = new Error("壳层未提供 api");
      missing.detail = missing.message;
      throw missing;
    }
    var data = await ctx.api(path, { method: "POST", body: body });
    if (data && data.status && data.status !== "success") {
      var err = new Error("请求未成功");
      err.detail = data.detail != null ? data.detail : (data.summary_text || data.summary || data);
      err.request_id = data.request_id;
      throw err;
    }
    return data || {};
  }

  async function postFile(fd) {
    var res;
    try {
      res = await fetch("/api/v1/import/file", { method: "POST", body: fd });
    } catch (err) {
      var net = new Error(err && err.message ? err.message : "网络错误");
      net.detail = net.message;
      throw net;
    }
    var text = await res.text();
    var data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = null;
      }
    }
    if (!res.ok || data == null || (data.status && data.status !== "success")) {
      var fail = new Error("HTTP " + res.status);
      if (data && data.detail != null) fail.detail = data.detail;
      else if (text) fail.detail = text;
      else fail.detail = "HTTP " + res.status;
      if (data && data.request_id) fail.request_id = data.request_id;
      throw fail;
    }
    return data;
  }

  function bindFile(form, out, ctx) {
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var dataset = read(form, "dataset_name") || "file_source_1";
      var sheet = read(form, "sheet_name");
      var filePath = read(form, "file_path");
      var limit = optionalInt(read(form, "limit"));
      if (!limit.ok) {
        show(out, "行数上限必须是整数。", "error");
        return;
      }
      var fileNode = form.elements.file;
      var file = fileNode && fileNode.files && fileNode.files[0];
      if (!file && !filePath) {
        show(out, "请选择本地文件，或填写服务器路径。", "error");
        return;
      }
      if (form.dataset.busy === "1") return;
      form.dataset.busy = "1";
      var fd = new FormData();
      if (file) fd.append("file", file);
      if (filePath) fd.append("file_path", filePath);
      fd.append("dataset_name", dataset);
      var sid = sessionIdOf(ctx);
      if (sid) fd.append("session_id", sid);
      /* 留空不传 sheet_name，服务端读取第一张工作表。 */
      if (sheet) fd.append("sheet_name", sheet);
      if (limit.value != null) fd.append("limit", String(limit.value));
      setBusy(form, true);
      try {
        var data = await postFile(fd);
        var name = data.dataset_name || dataset;
        presentOk(out, data, { name: name, sessionId: sid });
        safeNotify(ctx, "数据集「" + name + "」已进入当前会话");
      } catch (err) {
        show(out, messageOf(err), "error");
      } finally {
        form.dataset.busy = "";
        setBusy(form, false);
      }
    });
  }

  function bindDb(form, out, ctx) {
    form.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var conn = read(form, "conn_str");
      var query = read(form, "query_or_table");
      if (!conn || !query) {
        show(out, "请填写连接串与表名或查询。", "error");
        return;
      }
      var limit = optionalInt(read(form, "limit"));
      var parts = optionalInt(read(form, "num_partitions"));
      if (!limit.ok) {
        show(out, "行数上限必须是整数。", "error");
        return;
      }
      if (!parts.ok) {
        show(out, "分区数必须是整数。", "error");
        return;
      }
      var dataset = read(form, "dataset_name") || "db_source_1";
      var body = {
        conn_str: conn,
        query_or_table: query,
        dataset_name: dataset,
        mode: read(form, "mode") || "materialize"
      };
      var sid = sessionIdOf(ctx);
      if (sid) body.session_id = sid;
      if (limit.value != null) body.limit = limit.value;
      var filter = read(form, "filter_sql");
      if (filter) body.filter_sql = filter;
      var cols = splitCols(read(form, "select_cols"));
      if (cols.length) body.select_cols = cols;
      var partCol = read(form, "partition_col");
      if (partCol) body.partition_col = partCol;
      if (parts.value != null) body.num_partitions = parts.value;
      if (form.dataset.busy === "1") return;
      form.dataset.busy = "1";
      setBusy(form, true);
      try {
        var data = await postJson(ctx, "/api/v1/connect", body);
        presentOk(out, data, { name: dataset, sessionId: sid });
        safeNotify(ctx, "数据集「" + dataset + "」已进入当前会话");
      } catch (err) {
        show(out, messageOf(err), "error");
      } finally {
        form.dataset.busy = "";
        setBusy(form, false);
      }
    });
  }

  async function recordsFromFile(file) {
    var text = await file.text();
    var obj;
    try {
      obj = JSON.parse(text);
    } catch (parseErr) {
      try {
        var lines = text.split("\n").filter(function (line) { return line.trim(); });
        if (!lines.length) throw parseErr;
        obj = lines.map(function (line) { return JSON.parse(line); });
      } catch (lineErr) {
        var err = new Error("解析失败：" + (lineErr && lineErr.message ? lineErr.message : "不是合法 JSON"));
        err.client = true;
        throw err;
      }
    }
    var records = Array.isArray(obj) ? obj : (obj && Array.isArray(obj.events) ? obj.events : null);
    if (!records) {
      var rejected = new Error("仅支持 JSON 数组或 {events:[...]}；OTLP 请用路径导入。");
      rejected.client = true;
      throw rejected;
    }
    return records;
  }

  async function submitTrace(form, out, ctx, preset) {
    if (form.dataset.busy === "1") return;
    var dataset = read(form, "dataset_name") || "traces";
    var source = read(form, "source");
    var fmt = read(form, "format");
    var records = preset && preset.records ? preset.records : null;
    var fileNode = form.elements.file;
    var file = !records && fileNode && fileNode.files ? fileNode.files[0] : null;
    if (!records && !file && !source) {
      show(out, "请填写 trace 路径，或上传 JSON。", "error");
      return;
    }
    form.dataset.busy = "1";
    setBusy(form, true);
    try {
      if (!records && file) records = await recordsFromFile(file);
      var body = { dataset_name: dataset };
      var sid = sessionIdOf(ctx);
      if (sid) body.session_id = sid;
      if (records) body.records = records;
      else body.source = source;
      if (!records && fmt) body.format = fmt;
      var data = await postJson(ctx, "/api/v1/import/traces", body);
      var name = data.dataset_name || dataset;
      presentOk(out, data, { name: name, sessionId: sid });
      safeNotify(ctx, "数据集「" + name + "」已进入当前会话");
    } catch (err) {
      show(out, err && err.client ? err.message : messageOf(err), "error");
    } finally {
      form.dataset.busy = "";
      setBusy(form, false);
    }
  }

  function bindTrace(form, out, ctx) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      submitTrace(form, out, ctx, null);
    });
    var sample = form.querySelector("[data-action='sample']");
    if (sample) {
      sample.addEventListener("click", function () {
        submitTrace(form, out, ctx, {
          records: SAMPLE_TRACES.map(function (row) {
            var copy = Object.assign({}, row);
            if (copy.properties && typeof copy.properties === "object") {
              copy.properties = Object.assign({}, copy.properties);
            }
            return copy;
          })
        });
      });
    }
  }

  function buildFile(ctx) {
    var form = makeForm();
    form.appendChild(field("数据集名", textInput("dataset_name", "file_source_1", "", false)));
    form.appendChild(field(
      "工作表",
      textInput("sheet_name", "", "留空表示第一张表", false),
      "不填写则不传 sheet_name，服务端读取第一张工作表。"
    ));
    form.appendChild(field("行数上限", textInput("limit", "", "留空表示不限制", true)));
    form.appendChild(field("服务器路径", textInput("file_path", "", "服务器上的文件路径", true)));
    form.appendChild(field("本地文件", fileInput("file", ".xlsx,.xls,.csv,.parquet")));
    var actions = el("div", "sec-ingest-actions");
    actions.appendChild(primary("导入"));
    form.appendChild(actions);
    var result = resultBox();
    bindFile(form, result.out, ctx);
    return shell("支持 Excel、CSV、Parquet。可上传本地文件，或填写服务器路径。", form, result);
  }

  function buildDb(ctx) {
    var form = makeForm();
    form.appendChild(field(
      "连接串",
      textInput("conn_str", "", "sqlite:///data/x.db 或 postgresql://user:pass@host:5432/db", true)
    ));
    form.appendChild(field(
      "表名或查询",
      textInput("query_or_table", "", "表名或 SQL，例如 orders", true)
    ));
    form.appendChild(field("数据集名", textInput("dataset_name", "db_source_1", "", false)));
    form.appendChild(field("行数上限", textInput("limit", "", "留空表示不限制", true)));
    form.appendChild(field("抽取模式", selectInput("mode", [
      { value: "materialize", label: "materialize（ConnectorX 物化，默认）" },
      { value: "scanner", label: "scanner（DuckDB ATTACH 直查，PG/MySQL）" }
    ])));
    form.appendChild(field("过滤条件", textInput("filter_sql", "", "WHERE 条件，不含 WHERE", true)));
    form.appendChild(field("投影列", textInput("select_cols", "", "逗号分隔，留空表示全部列", true)));
    form.appendChild(field("分区列", textInput("partition_col", "", "并行分区列，可留空", true)));
    form.appendChild(field("分区数", textInput("num_partitions", "", "留空使用服务端默认 1", true)));
    var actions = el("div", "sec-ingest-actions");
    actions.appendChild(primary("连接并载入"));
    form.appendChild(actions);
    var result = resultBox();
    bindDb(form, result.out, ctx);
    return shell("连接串与表名或 SQL 必填。未填写的可选项不会提交。", form, result);
  }

  function buildTrace(ctx) {
    var form = makeForm();
    form.appendChild(field("数据集名", textInput("dataset_name", "traces", "", false)));
    form.appendChild(field(
      "文件路径",
      textInput("source", "", "traces.json / spans.parquet", true)
    ));
    form.appendChild(field("格式", selectInput("format", [
      { value: "", label: "自动识别" },
      { value: "otlp", label: "otlp" },
      { value: "json", label: "json" },
      { value: "ndjson", label: "ndjson" },
      { value: "csv", label: "csv" },
      { value: "parquet", label: "parquet" }
    ]), "仅路径导入时提交。留空由扩展名识别。"));
    form.appendChild(field(
      "本地 JSON",
      fileInput("file", ".json,.ndjson"),
      "上传优先于路径。仅支持 JSON 数组、NDJSON 或 {events:[...]}。OTLP 请用路径。"
    ));
    var actions = el("div", "sec-ingest-actions");
    actions.appendChild(primary("导入"));
    var sample = el("button", "sec-ingest-textbtn");
    sample.type = "button";
    sample.dataset.action = "sample";
    sample.textContent = "载入示例 trace";
    actions.appendChild(sample);
    form.appendChild(actions);
    var result = resultBox();
    bindTrace(form, result.out, ctx);
    return shell("路径支持 JSON、NDJSON、CSV、Parquet 与 OTLP。示例数据走同一导入接口。", form, result);
  }

  var BUILDERS = {
    file: buildFile,
    db: buildDb,
    trace: buildTrace
  };

  var TABS = [
    { id: "file", label: "导入文件" },
    { id: "db", label: "连接数据库" },
    { id: "trace", label: "导入 Trace" }
  ];

  function mount(container, ctx) {
    if (!container) return;
    injectStyle();
    var root = el("div", "sec-ingest-root");
    var tabs = el("div", "sec-ingest-tabs");
    tabs.setAttribute("role", "tablist");
    var panels = {};
    TABS.forEach(function (tab, index) {
      var button = el("button", "sec-ingest-tab" + (index === 0 ? " sec-ingest-tab-active" : ""));
      button.type = "button";
      button.textContent = tab.label;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", index === 0 ? "true" : "false");
      button.dataset.tab = tab.id;
      tabs.appendChild(button);
      var panel = BUILDERS[tab.id](ctx);
      panel.dataset.panel = tab.id;
      if (index !== 0) panel.hidden = true;
      panels[tab.id] = panel;
    });
    root.appendChild(tabs);
    TABS.forEach(function (tab) { root.appendChild(panels[tab.id]); });
    tabs.addEventListener("click", function (ev) {
      var button = ev.target && ev.target.closest ? ev.target.closest("button") : null;
      if (!button || !button.dataset.tab) return;
      var id = button.dataset.tab;
      var all = tabs.querySelectorAll(".sec-ingest-tab");
      for (var i = 0; i < all.length; i += 1) {
        var on = all[i].dataset.tab === id;
        all[i].classList.toggle("sec-ingest-tab-active", on);
        all[i].setAttribute("aria-selected", on ? "true" : "false");
      }
      Object.keys(panels).forEach(function (key) {
        panels[key].hidden = key !== id;
      });
    });
    container.textContent = "";
    container.appendChild(root);
  }

  window.DashboardSections.ingest = { mount: mount };
})();
