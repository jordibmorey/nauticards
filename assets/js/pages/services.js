import { SITE_ROOT } from "../config.js";
import { getServices, getCompanies } from "../dal.js";
import {
  normalize,
  debounce,
  safeText,
  safeAttr,
  tr,
} from "../utils.js";

const FAMILY_DEFS = [
  {
    id: "technical",
    titleKey: "services.family.technical.title",
    descKey: "services.family.technical.desc",
    fallbackTitle: "Sistemas y mantenimiento",
    fallbackDesc: "Servicios técnicos para estructura, mecánica, instalaciones y mantenimiento especializado.",
    icon: "wrench",
    serviceIds: [
      "mecanica",
      "transmision",
      "hidraulica",
      "fontaneria",
      "hvac",
      "baterias",
      "electrotecnia",
      "helices",
      "rigging",
      "veleria",
      "semirrigidas",
    ],
  },
  {
    id: "refit",
    titleKey: "services.family.refit.title",
    descKey: "services.family.refit.desc",
    fallbackTitle: "Refit y materiales",
    fallbackDesc: "Trabajos de estructura, acabados, interiorismo y mejora integral de embarcaciones.",
    icon: "hammer",
    serviceIds: [
      "acero",
      "inox",
      "fibra",
      "carpinteria",
      "cristal-metacrilato",
      "barnices",
      "tapiceria",
      "teka-cubierta",
      "soldadura-corte",
      "aislamiento-termico",
      "andamiaje",
      "refits-integrales",
      "astillero",
    ],
  },
  {
    id: "painting",
    titleKey: "services.family.painting.title",
    descKey: "services.family.painting.desc",
    fallbackTitle: "Pintura y tratamientos",
    fallbackDesc: "Protección, mantenimiento exterior y tratamientos preventivos del casco.",
    icon: "paintbrush",
    serviceIds: [
      "antifouling-pintura",
      "protecciones-de-pintura",
      "tratamiento-de-osmosis",
      "limpieza-pulido",
      "anticontaminacion",
    ],
  },
  {
    id: "operations",
    titleKey: "services.family.operations.title",
    descKey: "services.family.operations.desc",
    fallbackTitle: "Operación portuaria y estancia",
    fallbackDesc: "Servicios vinculados a marina, amarre, logística de varadero y permanencia.",
    icon: "anchor",
    serviceIds: [
      "amarres",
      "marina",
      "club-nautico",
      "varaderos",
      "pupilaje",
      "invernaje",
      "bunkering",
    ],
  },
  {
    id: "business",
    titleKey: "services.family.business.title",
    descKey: "services.family.business.desc",
    fallbackTitle: "Navegación y explotación",
    fallbackDesc: "Servicios comerciales y operativos para navegación, charter y compraventa.",
    icon: "ship-wheel",
    serviceIds: [
      "charter",
      "traslados",
      "venta-de-embarcaciones",
      "tienda-nautica",
      "escuela-nautica",
    ],
  },
  {
    id: "management",
    titleKey: "services.family.management.title",
    descKey: "services.family.management.desc",
    fallbackTitle: "Gestión y soporte profesional",
    fallbackDesc: "Apoyo administrativo, técnico y de coordinación para proyectos náuticos.",
    icon: "briefcase-business",
    serviceIds: [
      "asesoria",
      "gestoria",
      "peritaje",
      "seguros",
      "project-management",
    ],
  },
];

const FILTER_TO_FAMILIES = {
  all: null,
  featured: null,
  technical: ["technical", "refit", "painting"],
  operations: ["operations", "business"],
  management: ["management"],
};

const SERVICE_ICONS = {
  acero: "scan-search",
  "aislamiento-termico": "shield",
  amarres: "anchor",
  andamiaje: "construction",
  anticontaminacion: "shield-alert",
  "antifouling-pintura": "paintbrush",
  asesoria: "messages-square",
  astillero: "warehouse",
  barnices: "droplets",
  baterias: "battery-charging",
  bunkering: "fuel",
  carpinteria: "hammer",
  charter: "ship-wheel",
  "club-nautico": "flag",
  "cristal-metacrilato": "panels-top-left",
  electrotecnia: "zap",
  "escuela-nautica": "graduation-cap",
  fibra: "layers-3",
  fontaneria: "cylinder",
  gestoria: "files",
  hidraulica: "cog",
  hvac: "fan",
  helices: "rotate-cw",
  inox: "wrench",
  invernaje: "snowflake",
  "limpieza-pulido": "sparkles",
  marina: "map-pinned",
  mecanica: "wrench",
  peritaje: "search-check",
  "project-management": "clipboard-list",
  "protecciones-de-pintura": "shield-half",
  pupilaje: "building-2",
  "refits-integrales": "tool-case",
  rigging: "workflow",
  seguros: "shield-check",
  semirrigidas: "waves",
  "soldadura-corte": "flame",
  tapiceria: "armchair",
  "teka-cubierta": "grid-2x2",
  "tienda-nautica": "shopping-bag",
  transmision: "settings-2",
  traslados: "truck",
  "tratamiento-de-osmosis": "droplets",
  varaderos: "forklift",
  veleria: "flag-triangle-right",
  "venta-de-embarcaciones": "badge-euro",
};

function getFamilyByServiceId(serviceId) {
  return (
    FAMILY_DEFS.find((family) => family.serviceIds.includes(serviceId)) || null
  );
}

function getServiceIcon(serviceId, familyId = "") {
  return SERVICE_ICONS[serviceId] || {
    technical: "wrench",
    refit: "hammer",
    painting: "paintbrush",
    operations: "anchor",
    business: "ship-wheel",
    management: "briefcase-business",
  }[familyId] || "circle";
}

function sortByLocalizedName(a, b) {
  const locale = window.__lang === "en" ? "en" : "es";
  return (a.name || "").localeCompare(b.name || "", locale, {
    sensitivity: "base",
  });
}

function serviceMatchesQuery(service, query, family) {
  if (!query) return true;

  const haystack = [
    service.name || "",
    service.id || "",
    family?.fallbackTitle || "",
    tr(family?.titleKey || "", family?.fallbackTitle || ""),
  ]
    .join(" ")
    .trim();

  return normalize(haystack).includes(query);
}

function serviceMatchesFilter(service, activeFilter, family) {
  if (activeFilter === "all") return true;
  if (activeFilter === "featured") return Boolean(service.featured);

  const allowedFamilies = FILTER_TO_FAMILIES[activeFilter];
  if (!allowedFamilies) return true;

  return family ? allowedFamilies.includes(family.id) : false;
}

function buildSearchUrl(serviceId) {
  const url = new URL("buscar/", SITE_ROOT);
  url.searchParams.set("servicio", serviceId);
  return url.href;
}

function companyCountLabel(count) {
  if (count === 1) return tr("services.count.single", "1 empresa");
  return tr("services.count.plural", "{count} empresas").replace("{count}", String(count));
}

function renderHighlightCard(service, count, family) {
  const href = buildSearchUrl(service.id);
  const icon = getServiceIcon(service.id, family?.id);

  return `
    <article class="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition p-5 h-full">
      <a href="${safeAttr(href)}" class="block h-full no-underline hover:no-underline">
        <div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mb-4">
          <i data-lucide="${safeAttr(icon)}" class="w-5 h-5"></i>
        </div>

        <div class="space-y-2">
          <h3 class="text-base font-semibold text-slate-900 leading-snug">
            ${safeText(service.name || service.id)}
          </h3>

          <p class="text-sm text-slate-500">
            ${safeText(
              tr(
                "services.highlight.cardHint",
                "Explora empresas especializadas en esta categoría."
              )
            )}
          </p>

          <div class="pt-1 flex items-center justify-between gap-3">
            <span class="inline-flex items-center rounded-full bg-slate-50 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600">
              ${safeText(companyCountLabel(count))}
            </span>
            <i data-lucide="arrow-up-right" class="w-4 h-4 text-slate-400"></i>
          </div>
        </div>
      </a>
    </article>
  `;
}

function renderServiceItem(service, count, family) {
  const href = buildSearchUrl(service.id);
  const icon = getServiceIcon(service.id, family?.id);

  return `
    <a
      href="${safeAttr(href)}"
      class="group flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-slate-300 hover:bg-slate-50 transition no-underline hover:no-underline"
      aria-label="${safeAttr(service.name || service.id)}"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
          <i data-lucide="${safeAttr(icon)}" class="w-4.5 h-4.5"></i>
        </div>

        <div class="min-w-0">
          <div class="text-sm font-medium text-slate-900 truncate">
            ${safeText(service.name || service.id)}
          </div>
          <div class="text-xs text-slate-500 truncate">
            ${safeText(companyCountLabel(count))}
          </div>
        </div>
      </div>

      <i data-lucide="chevron-right" class="w-4 h-4 text-slate-400 shrink-0 group-hover:text-slate-600 transition"></i>
    </a>
  `;
}

function renderFamilyBlock(family, services, countsMap) {
  const title = tr(family.titleKey, family.fallbackTitle);
  const desc = tr(family.descKey, family.fallbackDesc);

  const items = services
    .slice()
    .sort(sortByLocalizedName)
    .map((service) => renderServiceItem(service, countsMap.get(String(service.id)) || 0, family))
    .join("");

  return `
    <section class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
      <div class="flex items-start gap-3 mb-5">
        <div class="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
          <i data-lucide="${safeAttr(family.icon)}" class="w-5 h-5"></i>
        </div>

        <div>
          <h3 class="text-lg font-semibold text-slate-900">${safeText(title)}</h3>
          <p class="text-sm text-slate-500 mt-1">${safeText(desc)}</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        ${items}
      </div>
    </section>
  `;
}

function activateChip(chips, nextFilter) {
  chips.forEach((chip) => {
    chip.dataset.active = chip.dataset.filter === nextFilter ? "true" : "false";
    if (chip.dataset.filter === nextFilter) {
      chip.classList.add("bg-slate-900", "text-white", "border-slate-900");
      chip.classList.remove("bg-white", "text-slate-700");
    } else {
      chip.classList.remove("bg-slate-900", "text-white", "border-slate-900");
      chip.classList.add("bg-white", "text-slate-700");
    }
  });
}

export async function initServicesPage() {
  const highlightsEl = document.getElementById("servicesPopular");
  const familiesEl = document.getElementById("servicesFamilies");
  const searchEl = document.getElementById("servicesSearch");
  const emptyStateEl = document.getElementById("servicesEmptyState");
  const metaEl = document.getElementById("servicesResultsMeta");
  const badgeEl = document.getElementById("servicesCountBadge");
  const highlightsSectionEl = document.getElementById("servicesHighlightsSection");
  const quickFiltersEl = document.getElementById("servicesQuickFilters");

  if (!familiesEl) return;

  const chips = Array.from(
    quickFiltersEl?.querySelectorAll("[data-filter]") || []
  );

  let activeFilter = "all";
  let allServices = [];
  let countsMap = new Map();

  try {
    const [services, companies] = await Promise.all([getServices(), getCompanies()]);

    allServices = (services || []).slice().sort(sortByLocalizedName);

    countsMap = new Map();
    for (const company of companies || []) {
      const ids = Array.isArray(company.service_ids)
        ? company.service_ids.map(String)
        : [];
      for (const serviceId of ids) {
        countsMap.set(serviceId, (countsMap.get(serviceId) || 0) + 1);
      }
    }

    const updateBadge = (visibleCount) => {
      if (!badgeEl) return;
      const textNode = badgeEl.querySelector("span:last-child");
      if (!textNode) return;

      textNode.textContent = tr(
        "services.hero.countDynamic",
        "{count} servicios disponibles"
      ).replace("{count}", String(visibleCount));
    };

    const render = () => {
      const query = normalize(searchEl?.value || "");

      const filteredServices = allServices.filter((service) => {
        const family = getFamilyByServiceId(service.id);
        return (
          serviceMatchesFilter(service, activeFilter, family) &&
          serviceMatchesQuery(service, query, family)
        );
      });

      const featuredServices = filteredServices
        .filter((service) => Boolean(service.featured))
        .slice(0, 8);

      const familyBlocks = FAMILY_DEFS.map((family) => {
        const servicesInFamily = filteredServices.filter((service) =>
          family.serviceIds.includes(service.id)
        );
        return { family, services: servicesInFamily };
      }).filter((block) => block.services.length > 0);

      if (highlightsEl) {
        if (featuredServices.length) {
          highlightsEl.innerHTML = featuredServices
            .map((service) => {
              const family = getFamilyByServiceId(service.id);
              return renderHighlightCard(
                service,
                countsMap.get(String(service.id)) || 0,
                family
              );
            })
            .join("");
          if (highlightsSectionEl) highlightsSectionEl.classList.remove("hidden");
        } else {
          highlightsEl.innerHTML = "";
          if (highlightsSectionEl) highlightsSectionEl.classList.add("hidden");
        }
      }

      familiesEl.innerHTML = familyBlocks
        .map(({ family, services }) => renderFamilyBlock(family, services, countsMap))
        .join("");

      const hasResults = filteredServices.length > 0;

      if (emptyStateEl) {
        emptyStateEl.classList.toggle("hidden", hasResults);
      }

      if (familiesEl) {
        familiesEl.classList.toggle("hidden", !hasResults);
      }

      if (metaEl) {
        metaEl.textContent = hasResults
          ? tr(
              "services.results.meta",
              "{count} categorías disponibles. Selecciona una para ver empresas relacionadas."
            ).replace("{count}", String(filteredServices.length))
          : tr(
              "services.results.emptyMeta",
              "No hay categorías que coincidan con la búsqueda actual."
            );
      }

      updateBadge(filteredServices.length || allServices.length);

      if (window.lucide) lucide.createIcons();
    };

    render();

    if (searchEl && searchEl.dataset.bound !== "1") {
      searchEl.dataset.bound = "1";
      searchEl.addEventListener(
        "input",
        debounce(() => render(), 120)
      );
    }

    if (chips.length) {
      chips.forEach((chip) => {
        chip.addEventListener("click", () => {
          activeFilter = chip.dataset.filter || "all";
          activateChip(chips, activeFilter);
          render();
        });
      });

      activateChip(chips, activeFilter);
    }
  } catch (error) {
    console.error(error);

    if (highlightsEl) highlightsEl.innerHTML = "";
    familiesEl.innerHTML = `
      <section class="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-2">
          ${safeText(tr("common.errorLoadingData", "Error cargando datos."))}
        </h3>
        <p class="text-sm text-slate-500">
          ${safeText(tr("services.error", "No se pudieron cargar los servicios en este momento."))}
        </p>
      </section>
    `;
    if (window.lucide) lucide.createIcons();
  }
}