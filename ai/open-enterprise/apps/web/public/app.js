const gate = document.querySelector("#gate");
const desk = document.querySelector("#desk");
const who = document.querySelector("#who");
let me = null;
let lastTrace = null;

document.querySelector("#login").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  const response = await api("/api/session", {
    method: "POST",
    body: { email: data.get("email"), password: data.get("password") },
  });
  if (!response.ok) {
    document.querySelector("#login-error").textContent = response.body.error;
    return;
  }
  await enter();
});

document.querySelector("#stage").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  const response = await api("/api/orders", {
    method: "POST",
    body: {
      customerName: data.get("customerName"),
      sku: data.get("sku"),
      qty: Number(data.get("qty")),
    },
  });
  if (!response.ok) return alert(response.body.error);
  lastTrace = response.body.evidenceTraceId;
  await refresh();
});

document.querySelector("#goal").addEventListener("submit", async (event) => {
  event.preventDefault();
  const goal = new FormData(event.target).get("goal");
  const response = await api("/api/console/run", { method: "POST", body: { goal } });
  document.querySelector("#goal-out").textContent = JSON.stringify(response.body, null, 2);
  lastTrace = response.ok ? response.body.evidenceTraceId : null;
  document.querySelector("#load-evidence").classList.toggle("hidden", !lastTrace);
  document.querySelector("#evidence-out").textContent = "";
  if (response.ok) await refresh();
});

document.querySelector("#load-evidence").addEventListener("click", async () => {
  const response = await api(`/api/evidence/${lastTrace}`);
  document.querySelector("#evidence-out").textContent = JSON.stringify(response.body, null, 2);
});

document.querySelector("#file").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.target);
  const response = await api("/api/attachments", {
    method: "POST",
    body: {
      filename: data.get("filename"),
      contentBase64: btoa(String(data.get("text"))),
    },
  });
  if (!response.ok) return alert(response.body.error);
  await refresh();
});

async function enter() {
  const session = await api("/api/me");
  if (!session.ok) return;
  me = session.body;
  gate.classList.add("hidden");
  desk.classList.remove("hidden");
  who.innerHTML = `${escapeHtml(me.name)} · ${escapeHtml(me.role)} <button id="logout" class="secondary" type="button">Sign out</button>`;
  document.querySelector("#logout").addEventListener("click", async () => {
    await api("/api/session/logout", { method: "POST" });
    location.reload();
  });
  const links = await api("/api/links");
  document.querySelector("#links").innerHTML = links.body.links.map((link) =>
    `<li><strong>${escapeHtml(link.from)}</strong> → <strong>${escapeHtml(link.to)}</strong> — ${escapeHtml(link.call)}</li>`,
  ).join("");
  await refresh();
}

async function refresh() {
  const [actions, orders, files] = await Promise.all([
    api("/api/actions"),
    api("/api/orders"),
    api("/api/attachments"),
  ]);
  document.querySelector("#actions").innerHTML = renderActions(actions.body.actions || []);
  document.querySelector("#orders").innerHTML = renderOrders(orders.body.orders || []);
  document.querySelector("#files").innerHTML = renderFiles(files.body.attachments || []);
  for (const button of document.querySelectorAll("[data-confirm]")) {
    button.addEventListener("click", async () => {
      const response = await api(`/api/actions/${button.dataset.confirm}/confirm`, { method: "POST" });
      if (!response.ok) return alert(response.body.error);
      await refresh();
    });
  }
}

function renderActions(actions) {
  if (actions.length === 0) return "<p class='hint'>No pending actions.</p>";
  return actions.map((action) => {
    const draft = action.payload;
    const confirm = me.role === "manager" && action.status === "pending"
      ? `<button type="button" data-confirm="${escapeHtml(action.id)}">Confirm</button>`
      : "";
    return `<div class="row"><div><strong>${escapeHtml(action.status)}</strong> ${escapeHtml(draft.qty)} ${escapeHtml(draft.sku)} for ${escapeHtml(draft.customerName)}</div>${confirm}</div>`;
  }).join("");
}

function renderOrders(orders) {
  if (orders.length === 0) return "<p class='hint'>No open orders yet.</p>";
  return orders.map((order) =>
    `<div class="row"><div>${escapeHtml(order.customerName)} · ${escapeHtml(order.sku)} · ${escapeHtml(order.qty)}</div><code>${escapeHtml(order.id.slice(0, 8))}</code></div>`,
  ).join("");
}

function renderFiles(files) {
  if (files.length === 0) return "";
  return files.map((file) =>
    `<div class="row"><div>${escapeHtml(file.filename)}</div><span>${escapeHtml(file.byteLength)} bytes</span></div>`,
  ).join("");
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, body: payload };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}

enter();
