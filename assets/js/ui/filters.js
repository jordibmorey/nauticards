import { safeText, safeAttr, normalize, tr, getQueryParams } from "../utils.js";

function hasValidSearch(filters) {
  const q = (filters.q || "").trim();
  return !!(filters.servicio || filters.puerto || q.length >= 3);
}

function renderSearchState({
  gridEl = document.getElementById("companiesGrid"),
  counterEl = document.querySelector(".results__header .small strong"),
  paginationEl = document.getElementById("paginationList"),
  icon = "search",
  eyebrow = "",
  title = "",
  text = "",
  chips = [],
  primaryHref = "",
  primaryLabel = "",
  secondaryHref = "",
  secondaryLabel = ""
} = {}) {
  if (counterEl) counterEl.textContent = "0";
  if (paginationEl) paginationEl.innerHTML = "";

  if (!gridEl) return;

  const chipsHtml = Array.isArray(chips) && chips.length
    ? `
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        ${chips.map(chip => `
          <span class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
            ${safeText(chip)}
          </span>
        `).join("")}
      </div>
    `
    : "";

  const secondaryHtml = secondaryHref && secondaryLabel
    ? `
      <a
        href="${safeAttr(secondaryHref)}"
        class="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
      >
        <i data-lucide="rotate-ccw" class="w-4 h-4"></i>
        ${safeText(secondaryLabel)}
      </a>
    `
    : "";

  const primaryHtml = primaryHref && primaryLabel
    ? `
      <a
        href="${safeAttr(primaryHref)}"
        class="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-primaryHover"
      >
        <i data-lucide="arrow-right" class="w-4 h-4"></i>
        ${safeText(primaryLabel)}
      </a>
    `
    : "";

  gridEl.innerHTML = `
    <div class="col-span-full">
      <div class="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-nauti-light/40 p-8 md:p-10 shadow-sm">
        <div class="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl"></div>
        <div class="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-nauti-base/10 blur-3xl"></div>

        <div class="relative mx-auto max-w-2xl text-center">
          <div class="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm">
            <i data-lucide="${safeAttr(icon)}" class="w-7 h-7"></i>
          </div>

          ${eyebrow ? `
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              ${safeText(eyebrow)}
            </p>
          ` : ""}

          <h3 class="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            ${safeText(title)}
          </h3>

          <p class="mt-3 text-sm md:text-base leading-relaxed text-slate-600">
            ${safeText(text)}
          </p>

          ${chipsHtml}

          ${(primaryHtml || secondaryHtml) ? `
            <div class="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              ${secondaryHtml}
              ${primaryHtml}
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `;

  gridEl.classList.remove("grid--single");

  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

export function renderMissingFiltersMessage({
  gridEl = document.getElementById("companiesGrid"),
  counterEl = document.querySelector(".results__header .small strong"),
  paginationEl = document.getElementById("paginationList"),
  message = tr(
    "search.empty",
    "Selecciona un puerto, un servicio o escribe al menos 3 letras para comenzar la búsqueda."
  ),
} = {}) {
  renderSearchState({
    gridEl,
    counterEl,
    paginationEl,
    icon: "compass",
    eyebrow: tr("search.state.start.eyebrow", "DIRECTORIO NÁUTICO"),
    title: tr("search.state.start.title", "Empieza tu búsqueda"),
    text: message,
    chips: [
      tr("search.state.chip1", "Ej.: Barcelona"),
      tr("search.state.chip2", "Ej.: Electrónica"),
      tr("search.state.chip3", "Ej.: antifouling")
    ],
    primaryHref: "../contacto/index.html",
    primaryLabel: tr("nav.addCompany", "Añadir empresa")
  });
}

export function renderNoResultsMessage({
  filters = {},
  gridEl = document.getElementById("companiesGrid"),
  counterEl = document.querySelector(".results__header .small strong"),
  paginationEl = document.getElementById("paginationList"),
} = {}) {
  const activeChips = [];

  if (filters.area) activeChips.push(`${tr("search.filters.zone", "Zona")}`);
  if (filters.puerto) activeChips.push(`${tr("search.filters.port", "Ciudad/Puerto")}`);
  if (filters.servicio) activeChips.push(`${tr("search.filters.service", "Servicio")}`);
  if ((filters.q || "").trim()) activeChips.push(`“${String(filters.q).trim()}”`);

  renderSearchState({
    gridEl,
    counterEl,
    paginationEl,
    icon: "inbox",
    eyebrow: tr("search.state.noResults.eyebrow", "SIN RESULTADOS"),
    title: tr("search.state.noResults.title", "No hemos encontrado empresas con esos filtros"),
    text: tr(
      "search.state.noResults.text",
      "Prueba una búsqueda más amplia, cambia el puerto o elimina algún filtro para ver más resultados."
    ),
    chips: activeChips,
    secondaryHref: "./index.html",
    secondaryLabel: tr("search.state.noResults.reset", "Limpiar búsqueda"),
    primaryHref: "../contacto/index.html",
    primaryLabel: tr("search.state.noResults.cta", "Añadir empresa")
  });
}

function setOptions(selectEl, options, placeholder = "Cualquiera") {
  if (!selectEl) return;
  const currentValue = selectEl.value;

  const html = [
    `<option value="">${safeText(placeholder)}</option>`,
    ...(options || []).map((opt) => `<option value="${safeAttr(opt.value)}">${safeText(opt.label)}</option>`),
  ].join("");

  selectEl.innerHTML = html;

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

  if (sWanted) {
    const ids = Array.isArray(company.service_ids) ? company.service_ids.map(String) : [];
    if (!ids.includes(sWanted)) return false;
  }

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

  if (pWanted) {
    const portIds = [];
    if (company.port_id != null) portIds.push(String(company.port_id));
    if (Array.isArray(company.secondary_port_ids)) portIds.push(...company.secondary_port_ids.map(String));
    if (!portIds.includes(pWanted)) return false;
  }

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
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  return s;
}

function normalizeEmail(email) {
  if (!email) return "";
  const s = String(email).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return "";
  return s;
}

function normalizePhone(phone) {
  if (!phone) return "";
  let s = String(phone).trim();
  if (!s) return "";
  s = s.replace(/[^\d+]/g, "");
  s = s.replace(/\+(?=.)/g, (m, i) => (i === 0 ? "+" : ""));
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
