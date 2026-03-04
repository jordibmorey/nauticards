import { safeText, safeAttr, normalize, tr, getQueryParams } from "../utils.js";


function hasValidSearch(filters) {
  const q = (filters.q || "").trim();
  return !!(filters.servicio || filters.puerto || q.length >= 3);
}

export function renderMissingFiltersMessage({
  gridEl = document.getElementById("companiesGrid"),
  counterEl = document.querySelector(".results__header .small strong"),
  paginationEl = document.getElementById("paginationList"),
  message = tr(
    "search.empty",
    "Selecciona un puerto, un servicio o escribe al menos 3 letras."
  ),
} = {}) {
  if (counterEl) counterEl.textContent = "0";

  if (gridEl) {
    gridEl.innerHTML = `
      <p class="body-text search-empty">
        ${safeText(message)}
      </p>
    `;
    gridEl.classList.remove("grid--single");
  }

  if (paginationEl) paginationEl.innerHTML = "";
}



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

function hydrateFormFromQuery(formEl = document.querySelector("form.filter-bar")) {
  if (!formEl) return;
  const filters = getQueryParams();

  const serviceEl = formEl.querySelector("[name='servicio']");
  const areaEl = formEl.querySelector("[name='area']");
  const portEl = formEl.querySelector("[name='puerto']");
  const qEl = formEl.querySelector("[name='q']");
  const pageEl = formEl.querySelector("[name='page']");

  if (serviceEl) serviceEl.value = filters.servicio;
  if (areaEl) areaEl.value = filters.area;
  if (portEl) portEl.value = filters.puerto;
  if (qEl) qEl.value = filters.q;
  if (pageEl) pageEl.value = filters.page || "1";
}


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


export {
  hasValidSearch,
  setOptions,
  hydrateFormFromQuery,
  companyMatchesFilters,
  normalizeWebsite,
  normalizeEmail,
  normalizePhone,
  normalizePort
};
