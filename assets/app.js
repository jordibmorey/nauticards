/* =========================================================
  BIGBLUE - app.js (Vanilla JS)

  ✅ PURPOSE (MVP):
  - Load catalogs + companies from static JSON files in /data/
  - Render Home + Buscar using the SAME list/pagination logic
  - Render Company detail page (/pages/empresa/index.html?id=...)
  - Keep HTML/CSS as source of truth (this file must stay coherent with the pages)

  ✅ DATA CONTRACT (IMPORTANT — keep this stable when migrating to Postgres/API):
  - IDs are strings or numbers, but treated as strings in JS comparisons.
  - companies.json (array of companies)
      {
        "id": 123,
        "name": "Náutica X",
        "slug": "nautica-x",                 // optional fallback
        "description": "...",
        "featured": true,                    // OR legacy: "destacada": true
        "service_ids": [1,2,3],              // service IDs
        "port_id": 10,                       // primary port
        "secondary_port_ids": [11,12],       // optional, where else they work
        "region_id": 3,                      // optional (can be derived from port->region)
        "address": "...",
        "email": "...",
        "phone": "...",
        "website": "https://...",
        "logo_url": "/assets/img/logos/x.webp",  // optional
        "images": ["/assets/img/companies/x/1.webp", ...] // optional
      }

  - services.json / ports.json / regions.json (arrays)
      { "id": 1, "name": "Mecánica", "slug": "mecanica" }
      { "id": 10, "name": "Port Olímpic", "region_id": 3 }
      { "id": 3, "name": "Catalunya", "slug": "catalunya" }

  ✅ NAMING RULES:
  - Use *_id and *_ids for relationships.
  - Use snake_case keys in JSON (as above).
  - In JS, always coerce IDs with String(id).

  ✅ MIGRATION PATH (Postgres/API later):
  - Only change the "DATA ACCESS LAYER" functions (getCompanies/getServices/...)
    so the rest of the UI logic stays untouched.

  /**
 * ============================================================
 *  BIGBLUE – Frontend App Controller (MVP)
 * ============================================================
 *
 * IMPORTANT ARCHITECTURAL NOTES (READ BEFORE MODIFYING)
 *
 * This file is designed around a clear separation between:
 *  - RENDERING (HTML generation, filtering, pagination)
 *  - EVENT BINDING (user interactions)
 *
 * ⚠️ CRITICAL RULE:
 * Event listeners MUST NOT be attached inside functions that
 * are re-executed on state changes (e.g. initHomePage()).
 *
 * Why:
 * - Pages are re-rendered frequently (filters, search, pagination).
 * - Rebinding listeners on each render causes duplicated handlers,
 *   progressive slowdowns, and eventual UI lockups.
 *
 * Solution used here:
 * - All event listeners are bound ONCE using `dataset.bound` guards
 *   or event delegation.
 * - Rendering functions may run many times; binding functions must not.
 *
 * URL & STATE MANAGEMENT:
 * - Automatic state changes (typing, select filters) use history.replaceState()
 *   to avoid polluting browser history.
 * - Intentional navigation (pagination, navigation links) uses pushState().
 * - popstate is handled to correctly restore UI state on back/forward.
 *
 * PERFORMANCE NOTES:
 * - Search input is debounced to avoid excessive re-rendering.
 * - Filtering and pagination are intentionally stateless and re-runnable.
 *
 * If performance degrades over time, FIRST CHECK:
 * - duplicated addEventListener calls
 * - missing bind-once guards
 *
 * ============================================================
 */
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



/* =========================================================
   Base paths (works in root AND in subfolder deployments)
   We compute paths relative to where /assets/app.js is served.
========================================================= */
const SCRIPT_URL = new URL(document.currentScript?.src || "", window.location.href);
// /assets/...
const ASSETS_BASE = new URL(".", SCRIPT_URL);
// site root = one level up from /assets/
const SITE_ROOT = new URL("..", ASSETS_BASE);

// IMPORTANT: we keep the old behavior: DATA paths without ".json" + fallback in loadJSON()
const DATA = {
  companies: new URL("data/companies", SITE_ROOT).href,
  services: new URL("data/services", SITE_ROOT).href,
  ports: new URL("data/ports", SITE_ROOT).href,
  regions: new URL("data/regions", SITE_ROOT).href,
  areas: new URL("data/areas", SITE_ROOT).href,
};

const PAGE_SIZE = 8;

/* =========================================================
   DOM hooks (Home + Buscar share these)
   Required by HTML:
   - #companiesGrid
   - #paginationList
   - form.filter-bar with [name='servicio'], [name='puerto'], [name='q'], optional [name='page']
   - ".results__header .small strong" for counter (optional)
========================================================= */
const grid = document.getElementById("companiesGrid");
const resultsCounter = document.querySelector(".results__header .small strong");
const filterForm = document.querySelector("form.filter-bar");
const paginationList = document.getElementById("paginationList");

/* =========================================================
   Utils
========================================================= */
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

function hasValidSearch(filters) {
  const q = (filters.q || "").trim();
  return !!(filters.servicio || filters.puerto || q.length >= 3);
}

function renderMissingFiltersMessage() {
  if (resultsCounter) resultsCounter.textContent = "0";
  if (grid) {
    grid.innerHTML = `
  <p class="body-text search-empty">
    ${safeText(
      tr(
        "search.empty",
        "Selecciona un puerto, un servicio o escribe al menos 3 letras."
      )
    )}
  </p>
`;

    grid.classList.remove("grid--single");
  }
  if (paginationList) paginationList.innerHTML = "";
}


/* =========================================================
   Data loading (cached)
   - Uses in-memory promise cache.
   - Tries URL as-is; if fails, tries URL + ".json"
   - Cache policy:
     - In local dev you might want fresh reads -> no-store
     - In prod, browser cache is good (static JSON)
========================================================= */
const cache = new Map();

function fetchCacheMode() {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  return isLocal ? "no-store" : "default";
}

async function loadJSON(url) {
  if (cache.has(url)) return cache.get(url);

  const p = (async () => {
    const tryFetch = async (u) => {
      const r = await fetch(u, { cache: fetchCacheMode() });
      if (!r.ok) throw new Error(`HTTP ${r.status} for ${u}`);
      return r.json();
    };

    try {
      return await tryFetch(url);
    } catch (e) {
      if (!url.endsWith(".json")) return await tryFetch(url + ".json");
      throw e;
    }
  })();

  cache.set(url, p);
  return p;
}

/* =========================================================
   DATA ACCESS LAYER (DAL)
========================================================= */

const API_BASE = "https://little-mouse-3bbe.jordibmorey.workers.dev";



async function getCompanies() {
  // ⚠️ LEGACY (evitar en Home/Buscar)
  const r = await fetch(`${API_BASE}/api/companies?mode=full&lang=${window.__lang || "es"}`);
  if (!r.ok) throw new Error(`Worker companies -> HTTP ${r.status}`);
  return r.json();
}

async function getCompaniesPaged({ q = "", servicio = "", puerto = "", page = 1, pageSize = 8 } = {}) {
  const u = new URL(`${API_BASE}/api/companies`);
  u.searchParams.set("lang", window.__lang || "es");
  if (q) u.searchParams.set("q", q);
  if (servicio) u.searchParams.set("servicio", servicio);
  if (puerto) u.searchParams.set("puerto", puerto);
  u.searchParams.set("page", String(page));
  u.searchParams.set("pageSize", String(pageSize));

  const r = await fetch(u.toString());
  // Si implementas el 400 missing_filters en el worker, aquí lo manejas fino:
  if (r.status === 400) return { items: [], total: 0, page: 1, pageSize };
  if (!r.ok) throw new Error(`Worker companies paged -> HTTP ${r.status}`);

  return r.json(); // { items, total, page, pageSize } con slim cards
}



async function getServices() {
  const r = await fetch(`${API_BASE}/api/services`);
  if (!r.ok) throw new Error(`Worker services -> HTTP ${r.status}`);

  const data = await r.json();
  return (data || []).map((s) => ({
    ...s,
    name: trDb(s.name_i18n, s.name || ""),
  }));
}


async function getPServices() {
  const r = await fetch(`${API_BASE}/api/p_services`);
  if (!r.ok) throw new Error("Error cargando p_services (worker)");

  const data = await r.json();
  return (data || []).map((s) => ({
    ...s,
    name: trDb(s.name_i18n, s.name || ""),
  }));
}


async function getPorts() {
  const r = await fetch(`${API_BASE}/api/ports?lang=${window.__lang || "es"}`);
  if (!r.ok) throw new Error(`Worker ports -> HTTP ${r.status}`);

  // ✅ el worker ya devuelve ARRAY normalizado
  return r.json();
}



async function getRegions() {
  const r = await fetch(`${API_BASE}/api/regions`);
  if (!r.ok) throw new Error(`Worker regions -> HTTP ${r.status}`);

  const data = await r.json();
  return (data || []).map((x) => ({
    ...x,
    name: trDb(x.name_i18n, x.name || ""),
  }));
}


async function getAreas() {
  const r = await fetch(`${API_BASE}/api/areas`);
  if (!r.ok) throw new Error(`Worker areas -> HTTP ${r.status}`);

  const data = await r.json();
  return (data || []).map((x) => ({
    ...x,
    name: trDb(x.name_i18n, x.name || ""),
  }));
}




/* =========================================================
   Query params
========================================================= */
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

/* =========================================================
   Select helpers
========================================================= */
function setOptions(selectEl, options, placeholder = "Cualquiera") {
  if (!selectEl) return;
  const currentValue = selectEl.value;

  const html = [
    `<option value="">${safeText(placeholder)}</option>`,
    ...(options || []).map((opt) => `<option value="${safeAttr(opt.value)}">${safeText(opt.label)}</option>`),
  ].join("");

  selectEl.innerHTML = html;

  // Restore if still exists
  if ([...selectEl.options].some((o) => o.value === currentValue)) {
    selectEl.value = currentValue;
  }
}

function normalizeWebsite(url) {
  if (!url) return "";
  let s = String(url).trim();
  if (!s) return "";
  // si meten "www.ejemplo.com" sin esquema
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}

function normalizeEmail(email) {
  if (!email) return "";
  const s = String(email).trim();
  // básico: si no parece email, lo descartamos
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "";
  return s;
}

function normalizePhone(phone) {
  if (!phone) return "";
  let s = String(phone).trim();
  if (!s) return "";

  // quita espacios y caracteres típicos manteniendo + y dígitos
  s = s.replace(/[^\d+]/g, "");

  // si hay múltiples + (mal) -> deja solo el primero al inicio
  s = s.replace(/\+(?=.)/g, (m, i) => (i === 0 ? "+" : ""));

  // opcional: si no empieza por + y es España y tiene 9 dígitos, podrías prefijar +34
  // (solo si TE INTERESA. Si no, lo dejamos tal cual)
  // if (!s.startsWith("+") && /^\d{9}$/.test(s)) s = "+34" + s;

  return s;
}

function normalizePort(p) {
  return {
    ...p,
    phone_raw: p.phone,
    website: normalizeWebsite(p.website),
    email: normalizeEmail(p.email),
    phone: normalizePhone(p.phone),
  };
}


function hydrateFormFromQuery() {
  if (!filterForm) return;
  const filters = getQueryParams();

  const serviceEl = filterForm.querySelector("[name='servicio']");
  const areaEl = filterForm.querySelector("[name=\'area\']");
  const portEl = filterForm.querySelector("[name='puerto']");
  const qEl = filterForm.querySelector("[name='q']");
  const pageEl = filterForm.querySelector("[name='page']");

  if (serviceEl) serviceEl.value = filters.servicio;
  if (areaEl) areaEl.value = filters.area;
  if (portEl) portEl.value = filters.puerto;
  if (qEl) qEl.value = filters.q;
  if (pageEl) pageEl.value = filters.page || "1";
}

/* =========================================================
   Filtering
========================================================= */
function companyMatchesFilters(company, filters, lookups) {
  const sWanted = filters.servicio ? String(filters.servicio) : "";
  const pWanted = filters.puerto ? String(filters.puerto) : "";
  const aWanted = filters.area ? String(filters.area) : "";
  const qWanted = normalize(filters.q);

  // services (N:N)
  if (sWanted) {
    const ids = Array.isArray(company.service_ids) ? company.service_ids.map(String) : [];
    if (!ids.includes(sWanted)) return false;
  }
  // area (derived from company ports -> port.area_id)
  if (aWanted) {
    const portIds = [];
    if (company.port_id != null) portIds.push(String(company.port_id));
    if (Array.isArray(company.secondary_port_ids)) portIds.push(...company.secondary_port_ids.map(String));

    const matchesArea = portIds.some((pid) => {
      const p = lookups?.ports?.get(String(pid));
      return p && String(p.area_id || "") === aWanted;
    });

    if (!matchesArea) return false;
  }



  // ports (primary or secondary)
  if (pWanted) {
    const portIds = [];
    if (company.port_id != null) portIds.push(String(company.port_id));
    if (Array.isArray(company.secondary_port_ids)) portIds.push(...company.secondary_port_ids.map(String));
    if (!portIds.includes(pWanted)) return false;
  }

  // text search (name + description)
  if (qWanted) {
    const hay = normalize(`${company.name || ""} ${company.description || ""}`);
    if (!hay.includes(qWanted)) return false;
  }

  return true;
}

/* =========================================================
   Rendering (cards)
========================================================= */
function companyDetailHref(company) {
  // Keep coherence with your real HTML: /pages/empresa/index.html
  const base = new URL("pages/empresa/index.html", SITE_ROOT).href;
  if (company?.id != null) return `${base}?id=${encodeURIComponent(String(company.id))}`;
  return `${base}?slug=${encodeURIComponent(String(company?.slug || ""))}`;
}

function renderCompanyCard(company, lookups, selectedServiceId = "") {
  const href = companyDetailHref(company);

  const isFeatured = Boolean(company?.featured ?? company?.destacada);

  // Services:
  // - Render ALL services (for completeness/SEO/future DB)
  // - Keep the visual layout as a single row that fades/cuts to the right
  // - If a service filter is active and the company has it, force it to appear first.
  const selected = String(selectedServiceId || "");

  const companyServiceIds = Array.isArray(company.service_ids) ? company.service_ids.map(String) : [];
  const idsToShow = [];

  if (selected && companyServiceIds.includes(selected)) idsToShow.push(selected);
  for (const id of companyServiceIds) {
    if (!idsToShow.includes(id)) idsToShow.push(id);
  }

  const serviceNames = idsToShow
    .map((id) => lookups.services.get(String(id))?.name)
    .filter(Boolean);

  // Note: each tag is nowrap; the container is 1-line with fade cut.
  const servicesHTML = serviceNames
    .map((n) => `<span class="tag" style="white-space:nowrap;">${safeText(n)}</span>`)
    .join("");

  const logoUrl = sanitizeUrl(company.logo);
  const logoHTML = logoUrl
    ? `<img class="company-card__logo" src="${safeAttr(logoUrl)}" alt="Logo de ${safeAttr(company.name)}" loading="lazy" decoding="async">`
    : "";

  const portName = company.port_id ? (lookups.ports.get(String(company.port_id))?.name || "—") : "—";
  const regionName =
    company.region_id && lookups.regions
      ? (lookups.regions.get(String(company.region_id))?.name || "—")
      : "—";

  const secCount = Array.isArray(company.secondary_port_ids) ? company.secondary_port_ids.length : 0;
  const portLabel = secCount > 0 ? `${portName} (+${secCount})` : portName;

  const email = (company.email || "").toString().trim();
  const website = sanitizeUrl(company.website);

  const contactBtn = email
  ? `<a class="button button--ghost" href="mailto:${safeAttr(email)}">${safeText(tr("company.action.contact", "Contactar"))}</a>`
  : (website
      ? `<a class="button button--ghost" href="${safeAttr(website)}" target="_blank" rel="noopener">${safeText(tr("company.field.web", "Web"))}</a>`
      : "");

  return `
  <article
    class="company-card ${isFeatured ? "company-card--featured" : ""}"
    role="listitem"
    style="display:flex; flex-direction:column; height:100%;"
  >
    <header class="company-card__header">
      ${logoHTML}

      <div class="company-card__headerText">
        <h3 class="company-card__title">
          <a href="${safeAttr(href)}">${safeText(company.name)}</a>
        </h3>

        <div
          class="company-card__tags"
          style="
            margin-top: var(--space-2);
            display:flex;
            gap: var(--space-2);
            flex-wrap: nowrap;
            overflow: hidden;
            white-space: nowrap;
            position: relative;
            -webkit-mask-image: linear-gradient(to right, #000 0%, #000 78%, transparent 100%);
                    mask-image: linear-gradient(to right, #000 0%, #000 78%, transparent 100%);
          "
        >
          ${servicesHTML || '<span class="tag">—</span>'}
        </div>
      </div>
    </header>

    <div style="margin-top:auto; display:grid; gap: var(--space-3);">
      <dl class="company-card__meta">
        <div><dt>${safeText(tr("company.field.port", "Puerto"))}</dt><dd>${safeText(portLabel)}</dd></div>
        <div><dt>${safeText(tr("common.region", "Región"))}</dt><dd>${safeText(regionName)}</dd></div>
      </dl>

      <footer class="company-card__footer">
        <a class="button button--secondary" href="${safeAttr(href)}">${safeText(tr("common.viewProfile", "Ver ficha"))}</a>
        ${contactBtn}
      </footer>
    </div>
  </article>
`;
}


/* =========================================================
   Pagination
========================================================= */
function renderPagination(totalItems, currentPage) {
  if (!paginationList) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  paginationList.innerHTML = "";

  // If only one page, hide pagination
  if (totalPages <= 1) return;

  const mkLi = (label, page, disabled = false, active = false) => {
    const li = document.createElement("li");
    li.className = "pagination__item";

    const a = document.createElement("a");
    a.className = "pagination__link" + (active ? " is-active" : "") + (disabled ? " is-disabled" : "");
    a.href = "#";
    a.textContent = label;

    if (disabled) {
      a.setAttribute("aria-disabled", "true");
      a.tabIndex = -1;
    } else {
      if (active) a.setAttribute("aria-current", "page");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (page === currentPage) return;
        setQueryParams({ page });
        // Re-render with new params (no full reload)
        rerenderCurrentPage().catch(console.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    li.appendChild(a);
    return li;
  };

  const mkEllipsis = () => {
    const li = document.createElement("li");
    li.className = "pagination__item pagination__ellipsis";
    const span = document.createElement("span");
    span.className = "pagination__link is-disabled";
    span.textContent = "…";
    li.appendChild(span);
    return li;
  };

  // Prev/Next + window like: 1 2 3 … 31 (and current stays highlighted)
  const frag = document.createDocumentFragment();

 // « -> primera página
frag.appendChild(mkLi("«", 1, currentPage === 1, false));

  const windowSize = 5;
  const half = Math.floor(windowSize / 2);

  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, currentPage + half);

  // Expand to keep windowSize when near edges
  const visible = end - start + 1;
  if (visible < windowSize) {
    const missing = windowSize - visible;
    start = Math.max(1, start - missing);
    end = Math.min(totalPages, end + (windowSize - (end - start + 1)));
  }

  // First page + leading ellipsis
  if (start > 1) {
    frag.appendChild(mkLi("1", 1, false, currentPage === 1));
    if (start > 2) frag.appendChild(mkEllipsis());
  }

  // Middle window (avoid duplicating 1 and last)
  for (let p = start; p <= end; p++) {
    frag.appendChild(mkLi(String(p), p, false, p === currentPage));
  }

  // Last page + trailing ellipsis
  if (end < totalPages) {
    if (end < totalPages - 1) frag.appendChild(mkEllipsis());
    frag.appendChild(mkLi(String(totalPages), totalPages, false, currentPage === totalPages));
  }

  // » -> última página
frag.appendChild(mkLi("»", totalPages, currentPage === totalPages, false));

  paginationList.appendChild(frag);
}


function initMobileMenu(){
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("mobileMenu");
  if (!toggle || !menu) return;

  const closeEls = menu.querySelectorAll("[data-close-menu]");

  const setOpen = (open) => {
    document.body.classList.toggle("menu-open", open);
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    setOpen(menu.hidden); // si está hidden => abrir
  });

  closeEls.forEach(el => el.addEventListener("click", () => setOpen(false)));

  // Cierra al clicar cualquier link del menú
  menu.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) setOpen(false);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 770) setOpen(false);
  });
}

/* =========================================================
   Pages
========================================================= */
function initHeaderServicesDropdown(servicesList) {
  const ul = document.getElementById("servicesMenuList");
  if (!ul) return;

  const buscarBase = new URL("pages/buscar/index.html", SITE_ROOT).href;

  const sorted = (servicesList || [])
    .slice()
    .sort(sortByName);

  if (!sorted.length) {
    ul.innerHTML = `<li style="padding:.55rem 1rem; color:#111;">${safeText(tr("services.none", "No hay servicios"))}</li>`;
    return;
  }

  ul.innerHTML = sorted
    .map((s) => {
      const id = String(s.id);
      const name = s.name || id;
      const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;

      return `
        <li>
          <a href="${safeAttr(href)}"
             style="display:block; padding:.55rem 1rem; text-decoration:none; color:#111;"
             onmouseover="this.style.background='#f2f4f7';"
             onmouseout="this.style.background='transparent';">
            ${safeText(name)}
          </a>
        </li>
      `;
    })
    .join("");
}

async function initHomePage() {
  // ✅ CAMBIO MÍNIMO: NO abortar toda la Home si no existe el grid de resultados.
  // if (!grid) return;

  const filters = getQueryParams();
  const requestedPage = parseInt(filters.page || "1", 10);
  const currentPage =
    Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageKey = document.body?.dataset?.page || "";
  const isHome = pageKey === "home";
  const isBuscar = pageKey === "buscar";


  try {
    const [servicesList, portsList, regionsList, areasList] = await Promise.all([
  getServices(),
  getPorts(),
  getRegions(),
  getAreas(),
]);

let companiesPage = null;
if (isBuscar && hasValidSearch(filters)) {
  companiesPage = await getCompaniesPaged({
    q: filters.q || "",
    servicio: filters.servicio || "",
    puerto: filters.puerto || "",
    page: currentPage,
    pageSize: PAGE_SIZE, // usa tu constante (8)
  });
}


    const lookups = {
      services: indexById(servicesList),
      ports: indexById(portsList),
      regions: regionsList ? indexById(regionsList) : null,
      areas: areasList ? indexById(areasList) : null,
    };



    // === SERVICIOS DESTACADOS EN HOME (mismo comportamiento que /pages/servicios) ===
    const popularListEl = document.getElementById("servicesPopular"); // puede existir o no
    if (popularListEl) {
      const buscarBase = new URL("pages/buscar/index.html", SITE_ROOT).href;
      const PLACEHOLDER = new URL("assets/img/placeholder.jpg", SITE_ROOT).href;

      const renderServiceCard = (s) => {
        const id = String(s.id);
        const name = s.name || id;
        const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;
        const imgUrl = s.image_url ? String(s.image_url) : PLACEHOLDER;

        return `
          <li class="card card--category">
            <a class="category-card__link" href="${safeAttr(
              href
            )}" aria-label="${safeAttr(name)}">
              <img
                class="category-card__img"
                src="${safeAttr(imgUrl)}"
                alt=""
                loading="lazy"
                onerror="this.onerror=null; this.src='${safeAttr(
                  PLACEHOLDER
                )}';"
              />
              <h3 class="company-card__title category-card__title">${safeText(
                name
              )}</h3>
            </a>
          </li>
        `;
      };

      const allSorted = (servicesList || [])
        .slice()
        .sort(sortByName);

      const featured = allSorted.filter((s) => Boolean(s.featured)).slice(0, 10);
      const section = popularListEl.closest("section");

      if (!featured.length) {
        if (section) section.style.display = "none";
      } else {
        if (section) section.style.display = "";
        popularListEl.innerHTML = featured.map(renderServiceCard).join("");
      }
    }

    // Populate selects from catalogs + hydrate form from URL
    if (filterForm) {
      const serviceEl = filterForm.querySelector("[name='servicio']");
      const areaEl = filterForm.querySelector("[name='area']");
      const portEl = filterForm.querySelector("[name='puerto']");
      const qEl = filterForm.querySelector("[name='q']");
      const submitBtn = filterForm.querySelector('button[type="submit"]');
      let buildPortOptions = null;
      let refreshPortsForArea = null;



      if (serviceEl) {
        const options = (servicesList || [])
          .slice()
          .sort(sortByName)
          .map((s) => ({ value: String(s.id), label: s.name || String(s.id) }));
        setOptions(serviceEl, options, tr("common.any", "Cualquiera"));
      }
      if (areaEl) {
        const options = (areasList || [])
          .slice()
          .sort(sortByName)
          .map((a) => ({ value: String(a.id), label: a.name || String(a.id) }));
        setOptions(areaEl, options, tr("common.any", "Cualquiera"));
      }

      if (portEl) {
        buildPortOptions = (wantedAreaId) => {
  const list = (portsList || []).filter((p) => {
    if (!wantedAreaId) return true;
    return String(p.area_id || "") === String(wantedAreaId);
  });

  return list
    .slice()
    .sort(sortByName)
    .map((p) => ({ value: String(p.id), label: p.name || String(p.id) }));
};

refreshPortsForArea = (areaId) => {
  const currentPort = portEl.value;
  setOptions(portEl, buildPortOptions(areaId), tr("common.any", "Cualquiera"));

  const stillExists = [...portEl.options].some((o) => o.value === currentPort);
  if (currentPort && !stillExists) portEl.value = "";
};



        const currentFilters = getQueryParams();
        setOptions(portEl, buildPortOptions(currentFilters.area), tr("common.any", "Cualquiera"));

        // Nota: el listener de area->puertos se bindea UNA sola vez dentro del guard dataset.bound.
      }

      hydrateFormFromQuery();
      if (areaEl && portEl && typeof refreshPortsForArea === "function") {
  refreshPortsForArea(areaEl.value || "");
}



      // Bind events once (prevents listener accumulation => slowdowns/freezes)
      if (filterForm.dataset.bound !== "1") {
        filterForm.dataset.bound = "1";

        const readForm = () => {
          const fd = new FormData(filterForm);
          return {
            area: fd.get("area") || "",
            servicio: fd.get("servicio") || "",
            puerto: fd.get("puerto") || "",
            q: fd.get("q") || "",
            page: "1",
          };
        };

          const updateSearchButtonState = () => {
            if (!submitBtn) return;
            const f = readForm();
            const enabled = hasValidSearch(f);

            submitBtn.disabled = !enabled;
            submitBtn.classList.toggle("is-disabled", !enabled);
            submitBtn.setAttribute("aria-disabled", String(!enabled));
          };

            if (areaEl && portEl && typeof refreshPortsForArea === "function") {
  areaEl.addEventListener("change", () => {
    refreshPortsForArea(areaEl.value || "");
    updateSearchButtonState();
  });
}



            // Inicial: tras hidratar valores (por si vienes con ?servicio=...)
            updateSearchButtonState();

            // Actualizar estado al tocar cualquier campo
            filterForm.addEventListener("input", updateSearchButtonState);
            filterForm.addEventListener("change", updateSearchButtonState);



        const closeMobileKeyboard = () => {
          const ae = document.activeElement;
          if (ae && typeof ae.blur === "function") ae.blur();
        };

        const scrollToResults = () => {
          const target =
            document.querySelector(".section.results") ||
            document.getElementById("companiesGrid") ||
            grid;

          if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        };

        const applyFilters = async (opts = { replace: false }) => {
          setQueryParams(readForm(), opts);
          // Re-render with new params (no full reload)
          await rerenderCurrentPage().catch(console.error);
          // UX on mobile: close keyboard + go to results
          closeMobileKeyboard();
          // Let the DOM paint before scrolling
          requestAnimationFrame(scrollToResults);
        };

        // Submit (Buscar) applies filters (intentional -> pushState)
        filterForm.addEventListener("submit", (e) => {
          e.preventDefault();

          updateSearchButtonState();

          const filters = readForm();
          if (!hasValidSearch(filters)) {
            renderMissingFiltersMessage();
            return;
          }

          const isHome = document.body.dataset.page === "home";

          if (isHome) {
            const params = new URLSearchParams(filters).toString();
            window.location.href = `${SITE_ROOT}pages/buscar/index.html?${params}`;
            return;
          }

          applyFilters({ replace: false });
        });


        // IMPORTANT: selects should NOT auto-filter. They only set form values.

        // q: Enter behaves like submit
        const qEl = filterForm.querySelector("[name='q']");
        if (qEl) {
          qEl.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter") {
              ev.preventDefault();
              filterForm.requestSubmit();
            }
          });
        }
      }
    }
  
    // ===============================
// HOME: no renderiza resultados
// ===============================
if (isHome) {
  if (resultsCounter) resultsCounter.textContent = "0";
  if (grid) grid.innerHTML = "";
  if (paginationList) paginationList.innerHTML = "";
  return;
}


// ===============================
// RESULTADOS (SOLO BUSCAR)
// ===============================
if (!isBuscar) return;

if (!hasValidSearch(filters)) {
  renderMissingFiltersMessage();
  return;
}

const items = companiesPage?.items || [];
const total = Number(companiesPage?.total || 0);
const safePage = Number(companiesPage?.page || 1);

if (resultsCounter) resultsCounter.textContent = String(total);

if (grid) {
  grid.innerHTML = items
    .map((c) => renderCompanyCard(c, lookups, filters.servicio))
    .join("");

  grid.classList.toggle("grid--single", items.length === 1);
}

// Paginación: solo si existe el contenedor
if (paginationList) {
  renderPagination(total, safePage);
}

} catch (err) {
  console.error(err);
  if (grid) {
    grid.innerHTML = `<p class="body-text">${tr(
      "common.errorLoadingData",
      "Error cargando datos."
    )}</p>`;
  }
  if (paginationList) paginationList.innerHTML = "";
}
}


async function initCompanyPage() {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("id");
  const slugParam = params.get("slug");

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  };

  try {
    const [companies, servicesList, portsList, regionsList, areasList] = await Promise.all([
      getCompanies(),
      getServices(),
      getPorts(),
      getRegions(),
      getAreas(),
    ]);

    const servicesById = indexById(servicesList);
    const portsById = indexById(portsList);
    const regionsById = regionsList ? indexById(regionsList) : null;

    let company = null;
    if (idParam) {
      company = companies.find((c) => String(c.id) === String(idParam));
    } else if (slugParam) {
      const wanted = String(slugParam).toLowerCase();
      company = companies.find((c) => String(c.slug || "").toLowerCase() === wanted);
    }

    if (!company) {
      setText("company-name", tr("company.notFound", "Empresa no encontrada"));

      return;
    }

    setText("company-name", company.name || "");
    setText("company-subtitle", company.slug ? company.slug : "");
    setText("company-description", company.description || "");

    // Servicios (mismo estilo que puertos: filas con línea fina)
const servicesEl = document.getElementById("company-services");
if (servicesEl) {
  const sIds = Array.isArray(company.service_ids)
    ? company.service_ids.map(String)
    : [];

  if (!sIds.length) {
    servicesEl.innerHTML = `<li class="service-row">—</li>`;
  } else {
    servicesEl.innerHTML = sIds
      .map((sid) => {
        const s = servicesById.get(String(sid));
        const label = s?.name || sid;
        return `<li class="service-row">${safeText(label)}</li>`;
      })
      .join("");
  }
}


    // Gallery (optional)
    const galleryEl = document.getElementById("company-gallery");
    if (galleryEl) {
      const imgs = Array.isArray(company.images) ? company.images : [];

      if (imgs.length === 0) {
        galleryEl.innerHTML = `
          <a href="/pages/contacto/index.html" class="gallery-thumb gallery-thumb--placeholder">
            <span>+</span>
          </a>
        `;
      } else {
        galleryEl.innerHTML = imgs
          .map((src) => {
            const safeSrc = sanitizeUrl(src);
            if (!safeSrc) return "";
            return `
              <a class="gallery-thumb" href="${safeAttr(safeSrc)}" target="_blank">
                <img src="${safeAttr(safeSrc)}" alt="${safeAttr(company.name || tr("company.imageAltFallback", "Imagen"))}"
 loading="lazy" />
              </a>
            `;
          })
          .join("");
      }
    }

    // Port / address / contact
    const portName =
      company.port_id != null ? portsById.get(String(company.port_id))?.name || "—" : "—";

    const secPorts = Array.isArray(company.secondary_port_ids) ? company.secondary_port_ids : [];
    const secNames = secPorts
      .map((pid) => portsById.get(String(pid))?.name)
      .filter(Boolean);

    const secEl = document.getElementById("company-secondary-ports");
    if (secEl) {
      secEl.textContent = secNames.length ? secNames.join(", ") : "—";
    }

    setText("company-port", portName);
    setText("company-address", company.address || "—");
    setText("company-phone", company.phone || "—");
    setText("company-email", company.email || "—");

    // Mapa (usa coords de empresa si existen; si no, fallback al puerto)
    const mapEl = document.getElementById("company-map");
    if (mapEl) {
      const p = company.port_id != null ? portsById.get(String(company.port_id)) : null;

      // En tu getCompanies() normalizas lon -> lng, así que aquí usamos company.lng
      const cLat = company.lat != null ? Number(company.lat) : null;
      const cLng = company.lng != null ? Number(company.lng) : null;

      const lat = Number.isFinite(cLat) ? cLat : p?.lat;
      const lon = Number.isFinite(cLng) ? cLng : p?.lon;

      if (typeof lat === "number" && typeof lon === "number") {
        const delta = 0.01;
        const left = lon - delta;
        const right = lon + delta;
        const bottom = lat - delta;
        const top = lat + delta;

        const u = new URL("https://www.openstreetmap.org/export/embed.html");
        u.searchParams.set("bbox", `${left},${bottom},${right},${top}`);
        u.searchParams.set("layer", "mapnik");
        u.searchParams.set("marker", `${lat},${lon}`);

        mapEl.src = u.toString();
      }
    }

    // Logo en cabecera
    const logoImg = document.getElementById("company-logo");
    if (logoImg) {
      const src = sanitizeUrl(company.logo);
      if (src) {
        logoImg.src = src;
        logoImg.alt = company.name || "Logo";
      } else {
        const wrap = logoImg.closest(".company-header__logo");
        if (wrap) wrap.style.display = "none";
      }
    }

    const webEl = document.getElementById("company-web");
    if (webEl) {
      const url = sanitizeUrl(company.website);
      webEl.innerHTML = url
        ? `<a href="${safeAttr(url)}" target="_blank" rel="noopener">${safeText(url)}</a>`
        : "—";
    }

    const contactBtn = document.getElementById("company-contact-btn");
    if (contactBtn) {
      const email = (company.email || "").toString().trim();
      if (email) {
        contactBtn.setAttribute("href", `mailto:${email}`);
        contactBtn.classList.remove("is-hidden");
      } else {
        contactBtn.classList.add("is-hidden");
      }
    }

    const fixBtn = document.getElementById("company-fix-btn");
    if (fixBtn) {
      fixBtn.setAttribute("href", new URL("pages/contacto/index.html", SITE_ROOT).href);
    }

    // Region (optional)
    const regionEl = document.getElementById("company-region");
    if (regionEl && regionsById) {
      const regionName =
        company.region_id != null ? regionsById.get(String(company.region_id))?.name || "—" : "—";
      regionEl.textContent = regionName;
    }
  } catch (err) {
    console.error(err);
    setText("company-name", tr("company.errorLoading", "Error cargando empresa"));

  }
}



async function initServicesPage() {
  const allListEl = document.getElementById("servicesGrid");
  if (!allListEl) return;

  const popularListEl = document.getElementById("servicesPopular"); // puede existir o no
  const searchEl = document.getElementById("servicesSearch"); // puede existir o no

  try {
    const [servicesList, companies] = await Promise.all([getServices(), getCompanies()]);

    // (Opcional) conteo de empresas por servicio, por si lo usas luego
    const counts = new Map();
    for (const c of companies || []) {
      const ids = Array.isArray(c.service_ids) ? c.service_ids.map(String) : [];
      for (const sid of ids) counts.set(sid, (counts.get(sid) || 0) + 1);
    }

    const buscarBase = new URL("pages/buscar/index.html", SITE_ROOT).href;
    const PLACEHOLDER = new URL("assets/img/placeholder.jpg", SITE_ROOT).href;

    // Card para "Populares" (si existe esa sección)
    const renderServiceCard = (s) => {
      const id = String(s.id);
      const name = s.name || id;
      const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;
      const imgUrl = s.image_url ? String(s.image_url) : PLACEHOLDER;

      return `
        <li class="card card--category">
          <a class="category-card__link" href="${safeAttr(href)}" aria-label="${safeAttr(name)}">
            <img
              class="category-card__img"
              src="${safeAttr(imgUrl)}"
              alt=""
              loading="lazy"
              onerror="this.onerror=null; this.src='${safeAttr(PLACEHOLDER)}';"
            />
            <h3 class="company-card__title category-card__title">${safeText(name)}</h3>
          </a>
        </li>
      `;
    };

    // Listado A-Z en GRID de 5 columnas (cada letra es un bloque/columna)
    const renderAllAlphabeticalColumns = (list) => {
      if (!list || !list.length) {
        allListEl.innerHTML =
          `<li class="card"><div class="card__inner"><p class="body-text">No hay servicios.</p></div></li>`;
        return;
      }

      // Agrupar por letra
      const groups = new Map();
      for (const s of list) {
        const name = (s.name || "").trim();
        const letter = (name[0] || "#").toUpperCase();
        if (!groups.has(letter)) groups.set(letter, []);
        groups.get(letter).push(s);
      }

      // Ordenar letras (# al final)
      const letters = Array.from(groups.keys()).sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        const locale = window.__lang === "en" ? "en" : "es";
        return a.localeCompare(b, locale, { sensitivity: "base" });
      });

      allListEl.innerHTML = letters
        .map((letter) => {
          const items = (groups.get(letter) || [])
            .slice()
            .sort(sortByName)
            .map((s) => {
              const id = String(s.id);
              const name = s.name || id;
              const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;

              return `
                <li class="service-item">
                  <a class="service-item__link" href="${safeAttr(href)}">${safeText(name)}</a>
                </li>
              `;
            })
            .join("");

          return `
            <li class="services-letter">
              <h3 class="services-letter__title">${safeText(letter)}</h3>
              <ul class="services-letter__list" aria-label="Servicios ${safeAttr(letter)}">
                ${items}
              </ul>
            </li>
          `;
        })
        .join("");
    };

    // Sort alfabético base
    const allSorted = (servicesList || [])
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

    // Asegura la clase correcta del contenedor (por si el HTML no la trae aún)
    allListEl.classList.add("services-columns");

    // === POPULARES (si existe bloque) ===
    if (popularListEl) {
      const featured = allSorted.filter((s) => Boolean(s.featured)).slice(0, 10);
      const section = popularListEl.closest("section");

      if (!featured.length) {
        if (section) section.style.display = "none";
      } else {
        if (section) section.style.display = "";
        popularListEl.innerHTML = featured.map(renderServiceCard).join("");
      }
    }

    // === TODOS (grid por letras en 5 columnas) ===
    renderAllAlphabeticalColumns(allSorted);

    // === SEARCH (filtra SOLO "Todos") ===
    if (searchEl && searchEl.dataset.bound !== "1") {
      searchEl.dataset.bound = "1";

      const doFilter = debounce(() => {
        const q = normalize(searchEl.value);
        if (!q) {
          renderAllAlphabeticalColumns(allSorted);
          return;
        }
        const filtered = allSorted.filter((s) => normalize(s.name).includes(q));
        renderAllAlphabeticalColumns(filtered);
      }, 120);

      searchEl.addEventListener("input", doFilter);
    }
  } catch (e) {
    console.error(e);
    allListEl.innerHTML =
      `<li class="card"><div class="card__inner"><p class="body-text">No se pudieron cargar los servicios.</p></div></li>`;
    if (popularListEl) popularListEl.innerHTML = "";
  }
}




// Reemplaza tu initPortsPage() por esta versión.
// OJO: esta función asume el HTML nuevo que hemos definido (IDs: portsSearch, portsSelect, portsList,
// portName, portHeroImg, portDescription, portServices, portMap, portBrowseLink, portMapExternal).

async function initPortsPage() {
  // ANTES: const searchEl = document.getElementById("portsSearch");
  // AHORA:
  const areaEl = document.getElementById("portsArea");
  const selectEl = document.getElementById("portsSelect");

  // Panel derecho (detalle)
  const nameEl = document.getElementById("portName");
  const heroImgEl = document.getElementById("portHeroImg");
  const descEl = document.getElementById("portDescription");
  const servicesEl = document.getElementById("portServices");
  const mapEl = document.getElementById("portMap");
  const browseLinkEl = document.getElementById("portBrowseLink");
  const detailPanelEl = document.getElementById("portDetailPanel");


  // ANTES: const mapExternalEl = document.getElementById("portMapExternal");
  // AHORA:
  const webExternalEl = document.getElementById("portWebExternal");

  // Contacto (NUEVO)
  const websiteEl = document.getElementById("portWebsite");
  const emailRowEl = document.getElementById("portEmailRow");
  const emailEl = document.getElementById("portEmail");
  const phoneRowEl = document.getElementById("portPhoneRow");
  const phoneEl = document.getElementById("portPhone");

  // Si no estamos en esta página, salir sin romper nada
  if (!areaEl || !selectEl || !nameEl || !heroImgEl || !descEl || !servicesEl || !mapEl || !browseLinkEl) return;

  const PLACEHOLDER = new URL("assets/img/placeholder.webp", SITE_ROOT).href;

  const UI_DEFAULTS = {
  portName: nameEl.textContent,
  portDesc: descEl.textContent,
  browseText: browseLinkEl.textContent,
  websiteDash: websiteEl ? websiteEl.textContent : "—",
};

  // Normaliza string: minúsculas + quita tildes/diacríticos + recorta espacios
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // diacríticos
      .toLowerCase()
      .trim();

  const openSelect = (selectEl) => {
    // Truco cross-browser para abrir el select
    const evt = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    selectEl.dispatchEvent(evt);
  };

  let portsList = [];
  let servicesList = [];
  let companies = [];
  let areasList = [];

  try {
    [portsList, servicesList, companies, areasList] = await Promise.all([getPorts(), getPServices(), getCompanies(), getAreas()]);
  } catch (e) {
    console.error(e);
    selectEl.innerHTML = `<option value="">${tr("ports.errorLoading", "— Error cargando puertos —")}</option>`;
    return;
  }

  const servicesById = indexById(servicesList);

  // Count companies per port (primary + secondary)
  const counts = new Map();
  for (const c of companies || []) {
    const ids = [];
    if (c.port_id != null) ids.push(String(c.port_id));
    if (Array.isArray(c.secondary_port_ids)) ids.push(...c.secondary_port_ids.map(String));
    for (const pid of ids) counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  const getPortIdFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("puerto") || "";
  };

  const getAreaIdFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("area") || "";
  };

  const makeOsmEmbedUrl = (lat, lon) => {
    const delta = 0.01;
    const left = lon - delta;
    const right = lon + delta;
    const bottom = lat - delta;
    const top = lat + delta;

    const u = new URL("https://www.openstreetmap.org/export/embed.html");
    u.searchParams.set("bbox", `${left},${bottom},${right},${top}`);
    u.searchParams.set("layer", "mapnik");
    u.searchParams.set("marker", `${lat},${lon}`);
    return u.toString();
  };

  // NUEVO: Botón "Abrir web"
  const setExternalWebLink = (url) => {
    if (!webExternalEl) return;
    webExternalEl.href = url;
    webExternalEl.classList.remove("is-disabled");
    webExternalEl.removeAttribute("aria-disabled");
  };

  const resetExternalWebLink = () => {
    if (!webExternalEl) return;
    webExternalEl.href = "#";
    webExternalEl.classList.add("is-disabled");
    webExternalEl.setAttribute("aria-disabled", "true");
  };

  const renderPortDetail = (p) => {
  // Si no hay puerto → ocultar panel entero
if (!p) {
  if (detailPanelEl) detailPanelEl.hidden = true;

  nameEl.textContent = tr("ports.select.title", UI_DEFAULTS.portName);
  heroImgEl.src = PLACEHOLDER;
  heroImgEl.alt = "";
  descEl.textContent = tr("ports.select.text", UI_DEFAULTS.portDesc);

  servicesEl.innerHTML = `<li><span class="tag">—</span></li>`;

  mapEl.src =
    "https://www.openstreetmap.org/export/embed.html?bbox=2.150%2C41.350%2C2.190%2C41.390&layer=mapnik";

  browseLinkEl.href = "../buscar/index.html";
  browseLinkEl.textContent = tr("ports.viewCompanies", UI_DEFAULTS.browseText);

  resetExternalWebLink();

  if (websiteEl) {
    websiteEl.textContent = UI_DEFAULTS.websiteDash; // normalmente "—"
    websiteEl.href = "#";
    websiteEl.classList.add("is-disabled");
    websiteEl.setAttribute("aria-disabled", "true");
  }

  if (emailRowEl) emailRowEl.style.display = "none";
  if (phoneRowEl) phoneRowEl.style.display = "none";

  return;
}


  // Hay puerto → mostrar panel
  if (detailPanelEl) detailPanelEl.hidden = false;


  const id = String(p.id);
  const name = p.name || id;

  // Hero
  const imgUrl = p.image_url ? String(p.image_url) : PLACEHOLDER;
  nameEl.textContent = name;
  heroImgEl.src = imgUrl;
  heroImgEl.alt = "";
  heroImgEl.onerror = () => {
    heroImgEl.onerror = null;
    heroImgEl.src = PLACEHOLDER;
  };

  // Descripción
  descEl.textContent = p.description ? String(p.description) : "Sin descripción disponible por ahora.";

  // ---- Contacto ----
  if (websiteEl) {
    if (p.website) {
      websiteEl.textContent = String(p.website).replace(/^https?:\/\//, "");
      websiteEl.href = String(p.website);
      websiteEl.classList.remove("is-disabled");
      websiteEl.removeAttribute("aria-disabled");
      setExternalWebLink(String(p.website));
    } else {
      websiteEl.textContent = "—";
      websiteEl.href = "#";
      websiteEl.classList.add("is-disabled");
      websiteEl.setAttribute("aria-disabled", "true");
      resetExternalWebLink();
    }
  } else {
    if (!p.website) resetExternalWebLink();
    else setExternalWebLink(String(p.website));
  }

  if (emailRowEl && emailEl) {
    if (p.email) {
      emailRowEl.style.display = "";
      emailEl.textContent = String(p.email);
      emailEl.href = `mailto:${String(p.email)}`;
    } else {
      emailRowEl.style.display = "none";
    }
  }

  if (phoneRowEl && phoneEl) {
    if (p.phone) {
      phoneRowEl.style.display = "";

      // Mostrar bonito
      const displayPhone = p.phone_raw || p.phone;
      phoneEl.textContent = displayPhone;

      // Limpiar para tel:
      const clean = String(p.phone).replace(/[^\d+]/g, "");
      phoneEl.href = `tel:${clean}`;
    } else {
      phoneRowEl.style.display = "none";
    }
  }

  // Servicios (chips)
  const sIds = Array.isArray(p.service_ids) ? p.service_ids.map(String) : [];
  if (!sIds.length) {
    servicesEl.innerHTML = `<li><span class="tag">—</span></li>`;
  } else {
    servicesEl.innerHTML = sIds
      .map((sid) => {
        const s = servicesById.get(String(sid));
        const label = s?.name || sid;
        return `<li class="service-row">${safeText(label)}</li>`;
      })
      .join("");

  }

  // Link a buscar filtrado por puerto
  browseLinkEl.href = `../buscar/index.html?puerto=${encodeURIComponent(id)}`;

  // Mapa (si hay lat/lon)
  const lat = p.lat ?? p.latitude;
  const lon = p.lon ?? p.longitude;

  if (typeof lat === "number" && typeof lon === "number" && isFinite(lat) && isFinite(lon)) {
    mapEl.src = makeOsmEmbedUrl(lat, lon);
  } else {
    mapEl.src =
      "https://www.openstreetmap.org/export/embed.html?bbox=2.150%2C41.350%2C2.190%2C41.390&layer=mapnik";
  }
};


  const sortPorts = (arr) =>
  (arr || []).slice().sort(sortByName);

// ✅ En /api/ports tu worker añade "pseudoPorts" de cities con suffix "(Ciudad)/(City)"
// ✅ Queremos ocultarlos SOLO en la página Puertos.
const isCityPseudoPort = (p) => {
  const d = String(p?.description || "");
  return /\s\((Ciudad|City)\)\s*$/i.test(d);
};

const allPorts = sortPorts((portsList || []).filter((p) => !isCityPseudoPort(p)));


  const findPortById = (id) => allPorts.find((p) => String(p.id) === String(id));

  let currentId = getPortIdFromURL();
  let currentAreaId = getAreaIdFromURL();

  const renderAreas = () => {
    const opts = (areasList || [])
      .slice()
      .sort(sortByName)
      .map((a) => `<option value="${safeAttr(a.id)}">${safeText(a.name || a.id)}</option>`)
      .join("");

    areaEl.innerHTML = `<option value="">${tr("common.any", "Cualquiera")}</option>${opts}`;

    if (currentAreaId) areaEl.value = currentAreaId;
  };

  // si vienes con ?id=... y no hay area, la deducimos del puerto
  if (currentId && !currentAreaId) {
    const p = findPortById(currentId);
    if (p?.area_id != null) currentAreaId = String(p.area_id);
  }

  const renderSelect = (filtered, selectedId) => {
    selectEl.innerHTML = `<option value="">${tr("ports.dropdownPlaceholder", "— Selecciona un puerto —")}</option>`;


    for (const p of filtered) {
      const opt = document.createElement("option");
      opt.value = String(p.id);

      const n = counts.get(String(p.id)) || 0;
      const label = p.name || String(p.id);
      opt.textContent = `${label}${n ? ` (${n})` : ""}`;

      if (String(p.id) === String(selectedId)) opt.selected = true;
      selectEl.appendChild(opt);
    }
  };

  const applyFilterAndRender = () => {
    currentAreaId = areaEl.value || currentAreaId || "";
    const filtered = !currentAreaId ? allPorts : allPorts.filter((p) => String(p.area_id || "") === String(currentAreaId));

    if (currentId && !filtered.some((p) => String(p.id) === String(currentId))) currentId = "";

    renderSelect(filtered, currentId);
    renderPortDetail(currentId ? findPortById(currentId) : null);
  };

  if (areaEl) {
    areaEl.addEventListener("change", () => {
      currentAreaId = areaEl.value || "";
      currentId = "";
      applyFilterAndRender();
      if (selectEl.options.length > 1) openSelect(selectEl);
    });
  }

  selectEl.addEventListener("change", () => {
    currentId = selectEl.value || "";
    applyFilterAndRender();
  });

  // Render inicial
  renderAreas();
  applyFilterAndRender();
  window.addEventListener("i18n:ready", () => {
  renderAreas();
  applyFilterAndRender();
}, { once: true });

}


/* =========================================================
   Services dropdown (A–Z) in header
========================================================= */
function bindNavDropdownBehavior(root) {
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const btn = root.querySelector(".nav-dropdown__trigger");
  const panel = root.querySelector(".nav-dropdown__panel");
  if (!btn || !panel) return;

  const close = () => {
    root.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    root.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  };

  // ===== DESKTOP HOVER (wrapper completo) =====
  root.addEventListener("mouseenter", open);
  root.addEventListener("mouseleave", close);

  // ===== CLICK / MOBILE =====
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    root.classList.contains("is-open") ? close() : open();
  });

  btn.addEventListener(
    "touchstart",
    (e) => {
      if (!root.classList.contains("is-open")) {
        e.preventDefault();
        open();
      }
    },
    { passive: false }
  );

  // ===== CLICK FUERA =====
  document.addEventListener("click", (e) => {
    if (!root.classList.contains("is-open")) return;
    if (root.contains(e.target)) return;
    close();
  });

  // ===== ESC =====
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function renderServicesDropdownPanel(panel, servicesList) {
  if (!panel) return;

  const buscarBase = new URL("pages/buscar/index.html", SITE_ROOT).href;

  // ===== Agrupar servicios por letra =====
  const groups = new Map();
  for (const s of servicesList || []) {
    const name = (s?.name || "").trim();
    const letter = (name[0] || "#").toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(s);
  }

  const letters = Array.from(groups.keys()).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b, "es");
  });

  const lettersHtml = letters
    .map((l) => `<button type="button" class="svcLetter" data-letter="${safeAttr(l)}">${safeText(l)}</button>`)
    .join("");

  const listsHtml = letters
    .map((l) => {
      const items = (groups.get(l) || [])
        .slice()
        .sort(sortByName)
        .map((s) => {
          const id = String(s.id);
          const name = s.name || id;
          const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;
          return `<a class="svcItem" href="${safeAttr(href)}">${safeText(name)}</a>`;
        })
        .join("");
      return `<div class="svcGroup" data-letter="${safeAttr(l)}">${items}</div>`;
    })
    .join("");

  // ===== HTML =====
  panel.innerHTML = `
    <div class="svcPanel">
      <div class="svcPanel__header">
        <input class="input input--sm svcSearch" type="search" placeholder="${tr("nav.services.searchPlaceholder", "Buscar servicio…")}" autocomplete="off" />
      </div>

      <div class="svcLetters">${lettersHtml}</div>

      <div class="svcSearchResults" style="display:none; padding:12px;"></div>

      <div class="svcLists">${listsHtml}</div>
    </div>
  `;

  const btns = Array.from(panel.querySelectorAll(".svcLetter"));
  const groupsEls = Array.from(panel.querySelectorAll(".svcGroup"));
  const searchEl = panel.querySelector(".svcSearch");
  const searchResultsEl = panel.querySelector(".svcSearchResults");
  const lettersBarEl = panel.querySelector(".svcLetters");
  const listsWrapEl = panel.querySelector(".svcLists");

  // ===== Mostrar letra =====
  const showLetter = (letter) => {
    if (searchEl && searchEl.value) {
      searchEl.value = "";
      Array.from(panel.querySelectorAll(".svcItem")).forEach((a) => (a.style.display = ""));
    }

    groupsEls.forEach((g) => (g.style.display = g.dataset.letter === letter ? "" : "none"));
    btns.forEach((b) => b.classList.toggle("is-active", b.dataset.letter === letter));
  };

  if (letters.length) showLetter(letters[0]);
  btns.forEach((b) => b.addEventListener("click", () => showLetter(b.dataset.letter)));

  // ===== Búsqueda =====
  if (searchEl) {
    const onSearch = debounce(() => {
      const q = normalize(searchEl.value);

      // ---- RESET ----
      if (!q) {
        if (lettersBarEl) lettersBarEl.style.display = "";
        if (listsWrapEl) listsWrapEl.style.display = "";
        if (searchResultsEl) searchResultsEl.style.display = "none";

        Array.from(panel.querySelectorAll(".svcItem")).forEach((a) => (a.style.display = ""));

        const active = btns.find((b) => b.classList.contains("is-active")) || btns[0];
        if (active) showLetter(active.dataset.letter);
        return;
      }

      // ---- MODO BÚSQUEDA (2 columnas) ----
      const matches = [];
      groupsEls.forEach((g) => {
        Array.from(g.querySelectorAll(".svcItem")).forEach((a) => {
          if (normalize(a.textContent).includes(q)) matches.push(a);
        });
      });

      if (lettersBarEl) lettersBarEl.style.display = "none";
      if (listsWrapEl) listsWrapEl.style.display = "none";
      if (searchResultsEl) searchResultsEl.style.display = "";

      btns.forEach((b) => b.classList.remove("is-active"));

      if (!searchResultsEl) return;

      if (!matches.length) {
        searchResultsEl.innerHTML = `<div style="padding:8px 0;color:#666;">No hay resultados.</div>`;
        return;
      }

      const seen = new Set();
      const itemsHtml = matches
        .map((a) => {
          const href = a.getAttribute("href") || "";
          if (seen.has(href)) return "";
          seen.add(href);

          return `
            <a href="${safeAttr(href)}"
               style="display:block;padding:10px 12px;border-radius:12px;text-decoration:none;color:#111;"
               onmouseover="this.style.background='#f2f4f7';"
               onmouseout="this.style.background='transparent';">
              ${safeText(a.textContent || "")}
            </a>`;
        })
        .join("");

      searchResultsEl.innerHTML = `
        <div style="font-weight:700;margin-bottom:8px;">
          ${matches.length} resultado${matches.length === 1 ? "" : "s"}
        </div>

        <div style="
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
          gap:6px 12px;
        ">
          ${itemsHtml}
        </div>
      `;
    }, 150);

    searchEl.addEventListener("input", onSearch);
  }
}

async function initServicesNavDropdown() {
  const dropdownPanels = Array.from(document.querySelectorAll("[data-services-dropdown]"));
  if (!dropdownPanels.length) return;

  dropdownPanels.forEach((panel) => bindNavDropdownBehavior(panel.closest(".nav-dropdown")));

  try {
    const servicesList = await getServices();
    dropdownPanels.forEach((panel) => renderServicesDropdownPanel(panel, servicesList || []));
  } catch (err) {
    console.error(err);
  }
}


/* =========================================================
   Router by page
   Uses: <body data-page="home|buscar|company|servicios|puertos">
========================================================= */
const routes = {
  home: initHomePage,
  buscar: initHomePage,     // Buscar reuses Home logic + query params
  company: initCompanyPage,
  servicios: initServicesPage,
  puertos: initPortsPage,
};

function rerenderCurrentPage() {
  const page = document.body?.dataset?.page || "home";
  const fn = routes?.[page] || routes?.home;
  if (typeof fn === "function") return fn();
}

// =========================
// FORMS (HOME CTA + CONTACT)
// =========================

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function safe(v) {
  return (v ?? "").toString().trim();
}

async function postJSON(path, payload) {
  const url = new URL(path, SITE_ROOT).href; // SITE_ROOT ya lo tienes definido en tu app.js
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => ({}));
}

function bindHomeCtaForm() {
  const form = document.querySelector(".cta-form__form");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      source: "home_cta",
      lang: window.__lang || "es",
      nombre: safe(fd.get("nombre")),
      email: safe(fd.get("email")),
      mensaje: safe(fd.get("mensaje")),
      page: location.href,
    };

    if (!payload.nombre || !payload.email || !payload.mensaje) return;
    if (!isEmail(payload.email)) return;

    const btn = form.querySelector("button[type='submit']");
    const oldText = btn?.textContent || "Enviar";

    try {
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = "Enviando…";

      await postJSON("/api/forms/home", payload);

      form.reset();
      if (btn) btn.textContent = "Enviado ✓";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 1500);
    } catch (err) {
      console.error("HOME CTA form error:", err);
      if (btn) btn.textContent = "Error. Intenta de nuevo";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 2000);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function bindContactForm() {
  const form = document.getElementById("contactForm");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  const statusEl = document.getElementById("contactStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      source: "contact_page",
      lang: window.__lang || "es",
      nombre: safe(fd.get("nombre")),
      email: safe(fd.get("email")),
      motivo: safe(fd.get("motivo")),
      mensaje: safe(fd.get("mensaje")),
      page: location.href,
    };

    if (!payload.nombre || !payload.email || !payload.motivo || !payload.mensaje) return;
    if (!isEmail(payload.email)) return;

    const btn = form.querySelector("button[type='submit']");
    const oldText = btn?.textContent || "Enviar";

    try {
      if (statusEl) statusEl.textContent = "Enviando…";
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = "Enviando…";

      await postJSON("/api/forms/contact", payload);

      form.reset();
      if (statusEl) statusEl.textContent = "Enviado ✓ Te responderemos pronto.";
      if (btn) btn.textContent = "Enviado ✓";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 1500);
    } catch (err) {
      console.error("CONTACT form error:", err);
      if (statusEl) statusEl.textContent = "Error enviando. Prueba más tarde.";
      if (btn) btn.textContent = "Error";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 2000);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

// Init
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body?.dataset?.page || "home";
  const fn = routes[page];

  initServicesNavDropdown().catch(console.error);
  if (typeof fn === "function") fn().catch(console.error);

  // Inicializar formularios (home CTA + contacto)
  bindHomeCtaForm();
  bindContactForm();
    initMobileMenu();


  // Browser Back/Forward should re-hydrate current page state
  window.addEventListener("popstate", () => {
    const p = rerenderCurrentPage();
    if (p && typeof p.catch === "function") p.catch(console.error);
  });
});


