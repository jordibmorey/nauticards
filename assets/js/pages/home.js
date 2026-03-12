import { SITE_ROOT, PAGE_SIZE } from "../config.js";

import {
  getCompaniesPaged,
  getRegions,
  getAreas,
  getPorts,
  getServices
} from "../dal.js";

import {
  normalize,
  safeText,
  safeAttr,
  indexById,
  sortByName,
  getQueryParams,
  setQueryParams,
  tr
} from "../utils.js";


import {
  hasValidSearch,
  hydrateFormFromQuery,
  companyMatchesFilters,
  setOptions,
  renderMissingFiltersMessage
} from "../ui/filters.js";


import { renderPagination } from "../ui/pagination.js";
import { rerenderCurrentPage } from "../router.js";

import { renderCompanyCard } from "../ui/cards.js";
import { initPortsMap } from "../ui/portmap.js";
import { updateBuscarSEO } from "../seo.js";

import { renderNoResultsMessage} from "../ui/filters.js";

// DOM hooks (Home + Buscar share these)
const grid = document.getElementById("companiesGrid");
const resultsCounter = document.querySelector(".results__header .small strong");
const filterForm = document.querySelector("form.filter-bar");
const paginationList = document.getElementById("paginationList");




export async function initHomePage() {
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

await initPortsMap();


    const lookups = {
      services: indexById(servicesList),
      ports: indexById(portsList),
      regions: regionsList ? indexById(regionsList) : null,
      areas: areasList ? indexById(areasList) : null,
    };



    // === SERVICIOS DESTACADOS EN HOME (mismo comportamiento que /pages/servicios) ===
const popularListEl = document.getElementById("servicesPopular");

if (popularListEl) {
  const buscarBase = new URL("buscar/", SITE_ROOT).href;
  const PLACEHOLDER = "https://r2.flowith.net/sandbox-placeholder.png";

  const getServiceIcon = (service) => {
    const id = String(service?.id || "").toLowerCase();
    const name = String(service?.name || "").toLowerCase();

    if (id.includes("mecan") || name.includes("mecan")) return "wrench";
    if (id.includes("elect") || name.includes("electr")) return "radio";
    if (id.includes("vela") || id.includes("jarcia") || name.includes("veler")) return "wind";
    if (id.includes("antifoul") || name.includes("antifoul")) return "droplets";
    if (id.includes("fibra") || name.includes("composite")) return "layers";
    if (id.includes("charter") || name.includes("charter")) return "ship";
    if (id.includes("asesoria") || name.includes("asesor")) return "briefcase";
    if (id.includes("gestoria") || name.includes("gestor")) return "files";
    if (id.includes("varaderos") || name.includes("varadero")) return "warehouse";
    if (id.includes("venta") || name.includes("venta")) return "badge-euro";
    if (id.includes("carpinteria") || name.includes("carpinter")) return "hammer";
    if (id.includes("pupilaje") || name.includes("pupilaje")) return "anchor";
    return "wrench";
  };

  const renderServiceCard = (s) => {
    const id = String(s.id);
    const name = s.name || id;
    const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;
    const imgUrl = s.image_url ? String(s.image_url) : PLACEHOLDER;
    const icon = getServiceIcon(s);

    return `
      <a href="${safeAttr(href)}" class="group block h-full">
        <article class="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden h-full flex flex-col">
          <div class="relative h-36 overflow-hidden bg-slate-200">
            <img
              src="${safeAttr(imgUrl)}"
              alt="${safeAttr(name)}"
              loading="lazy"
              class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onerror="this.onerror=null; this.src='${safeAttr(PLACEHOLDER)}';"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-900/55 via-slate-900/10 to-transparent"></div>

            <div class="absolute left-5 bottom-5 w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-lg">
              <i data-lucide="${safeAttr(icon)}" class="w-5 h-5"></i>
            </div>
          </div>

          <div class="p-6 flex flex-col flex-1">
            <h3 class="text-xl font-bold tracking-tight text-nauti-dark mb-2 leading-tight">
              ${safeText(name)}
            </h3>

            <p class="text-slate-500 text-sm mb-6">
              ${safeText(
                tr("services.explore_specialists_in", "Explora empresas especializadas en {service}.")
                  .replace("{service}", String(name).toLowerCase())
              )}
            </p>

            <span class="mt-auto inline-flex items-center gap-2 text-nauti-base font-medium group-hover:text-nauti-hover transition-colors">
              ${safeText(tr("services.view_companies", "Ver empresas"))}
              <i data-lucide="arrow-right" class="w-4 h-4 transition-transform group-hover:translate-x-1"></i>
            </span>
          </div>
        </article>
      </a>
    `;
  };

  const allSorted = (servicesList || []).slice().sort(sortByName);
  const featured = allSorted.filter((s) => Boolean(s.featured)).slice(0, 10);
  const section = popularListEl.closest("section");

  if (!featured.length) {
    if (section) section.style.display = "none";
  } else {
    if (section) section.style.display = "";
    popularListEl.innerHTML = featured.map(renderServiceCard).join("");
    if (window.lucide) lucide.createIcons();
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
    document.getElementById("resultsTitle") ||
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
            renderMissingFiltersMessage({
  gridEl: grid,
  counterEl: resultsCounter,
  message: tr("search.missingFilters", "Selecciona filtros para buscar")
});
            return;
          }

          const isHome = document.body.dataset.page === "home";

          if (isHome) {
            const params = new URLSearchParams(filters).toString();
            window.location.href = `${new URL("buscar/", SITE_ROOT).href}?${params}`;
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

if (total === 0) {
  renderNoResultsMessage({
    filters,
    gridEl: grid,
    counterEl: resultsCounter,
    paginationEl: paginationList
  });
  return;
}

if (grid) {
  grid.innerHTML = items
    .map((c) => renderCompanyCard(c, lookups, filters.servicio))
    .join("");
  grid.classList.toggle("grid--single", items.length === 1);
}

// ✅ SEO dinámico aquí
updateBuscarSEO({ filters, lookups, total });

// Paginación: solo si existe el contenedor
if (paginationList) {

  renderPagination({
  container: paginationList,
  totalItems: total,
  currentPage: safePage,
  pageSize: PAGE_SIZE,
  onPageChange: (newPage) => {
  setQueryParams({ page: newPage });
  rerenderCurrentPage().catch(console.error);
}
});

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