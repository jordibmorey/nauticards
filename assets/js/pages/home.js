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