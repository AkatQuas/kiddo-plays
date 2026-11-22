const ENGINE = "manufacturing";

const modules = document.querySelector("#modules");
const ledgers = document.querySelector("#ledgers");

const catalog = await fetch(`/api/${ENGINE}/catalog`).then((response) => response.json());
const ledger = await fetch(`/api/${ENGINE}/ledgers`).then((response) => response.json());

const byDomain = new Map();
for (const mod of catalog.modules) {
  const list = byDomain.get(mod.domain) ?? [];
  list.push(mod);
  byDomain.set(mod.domain, list);
}
modules.innerHTML = [...byDomain.entries()].map(([domain, items]) =>
  `<h3>${escapeHtml(domain)}</h3><ul>${items.map((item) => `<li><code>${escapeHtml(item.code)}</code> ${escapeHtml(item.label)}</li>`).join("")}</ul>`,
).join("");

ledgers.innerHTML = Object.values(ledger.ledgers).map((book) =>
  `<article><h3>${escapeHtml(book.label)} <code>${escapeHtml(book.code)}</code></h3><p>${escapeHtml(book.measure)} · ${escapeHtml(book.subject)}${book.scope ? " / " + escapeHtml(book.scope) : ""}</p><p>${Object.entries(book.ops).map(([op, sign]) => `${escapeHtml(op)} ${sign > 0 ? "+" : ""}${sign}`).join(" · ")}</p></article>`,
).join("");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[char]));
}
