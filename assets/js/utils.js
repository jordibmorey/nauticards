function normalize(str) {
  return (str || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .trim();
}


function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
// Escape text for safe insertion into innerHTML
function escapeHTML(value) {
  return (value ?? "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// For text nodes inside template literals
function safeText(value) {
  return escapeHTML(value ?? "");
}

// For HTML attributes (also escaped)
function safeAttr(value) {
  return escapeHTML(value ?? "");
}

// Very small URL sanitizer for external links (prevents javascript: etc.)
function sanitizeUrl(url) {
  const raw = (url || "").toString().trim();
  if (!raw) return "";
  // Allow relative URLs starting with /
  if (raw.startsWith("/")) return raw;
  try {
    const u = new URL(raw, window.location.href);
    const proto = u.protocol.toLowerCase();
    if (proto === "http:" || proto === "https:") return u.href;
    return "";
  } catch {
    return "";
  }
}

// Build Map(id -> object)
function indexById(list) {
  const m = new Map();
  (list || []).forEach((it) => {
    if (it && it.id != null) m.set(String(it.id), it);
  });
  return m;
}

function tr(key, fallback = "") {
  const t = window.__t;
  return t && t[key] != null ? t[key] : fallback;
}

function trDb(json, fallback = "") {
  if (!json) return fallback;

  const lang = window.__lang || "es";

  // por si algún sitio aún devuelve string plano
  if (typeof json === "string") return json;

  return json[lang] ?? json.es ?? fallback;
}
window.__lang = (new URLSearchParams(location.search).get("lang") || localStorage.getItem("lang") || "es").toLowerCase() === "en" ? "en" : "es";

function sortByName(a, b) {
  const locale = window.__lang === "en" ? "en" : "es";
  return (a.name || "").localeCompare(b.name || "", locale, {
    sensitivity: "base",
  });
}

function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    area: params.get("area") || "",
    servicio: params.get("servicio") || "",
    puerto: params.get("puerto") || "",
    q: params.get("q") || "",
    page: params.get("page") || "1",
  };
}

function setQueryParams(next, options = {}) {
  const params = new URLSearchParams(window.location.search);
  Object.entries(next || {}).forEach(([k, v]) => {
    if (v == null || v === "" || v === false) params.delete(k);
    else params.set(k, String(v));
  });
  const qs = params.toString();
  const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  if (options.replace) window.history.replaceState({}, "", url);
  else window.history.pushState({}, "", url);
}

export {
  normalize, debounce, escapeHTML, safeText, safeAttr,
  sanitizeUrl, indexById, tr, trDb,
  sortByName, getQueryParams, setQueryParams
};
