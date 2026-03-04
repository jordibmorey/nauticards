// assets/js/seo.js
import { SITE_ROOT } from "./config.js";

function ensureMeta(name) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureCanonical() {
  let el = document.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  return el;
}

// Canonical “limpio”: quita vacíos, quita page=1, NO mete q para evitar infinitas combinaciones
function buildBuscarCanonical(filters) {
  const params = new URLSearchParams();

  const servicio = (filters?.servicio || "").toString().trim();
  const area = (filters?.area || "").toString().trim();
  const puerto = (filters?.puerto || "").toString().trim();
  const page = (filters?.page || "").toString().trim();

  if (servicio) params.set("servicio", servicio);
  if (area) params.set("area", area);
  if (puerto) params.set("puerto", puerto);
  if (page && page !== "1") params.set("page", page);

  const base = new URL("pages/buscar/", SITE_ROOT).href;
  return params.toString() ? `${base}?${params.toString()}` : base;
}

function buildEmpresaCanonical({ idParam, slugParam }) {
  const base = new URL("pages/empresa/", SITE_ROOT);
  // Canonical estable: prioriza ID para evitar duplicados
  if (idParam) base.searchParams.set("id", String(idParam));
  else if (slugParam) base.searchParams.set("slug", String(slugParam));
  return base.href;
}

/**
 * SEO para la página /pages/buscar/
 * - title / description / robots / canonical
 * - actualiza el H1 visible si existe: h1.page-title
 */
export function updateBuscarSEO({ filters, lookups, total }) {
  const servicioId = (filters?.servicio || "").toString().trim();
  const areaId = (filters?.area || "").toString().trim();
  const puertoId = (filters?.puerto || "").toString().trim();
  const q = (filters?.q || "").toString().trim();

  const servicioName = servicioId
    ? lookups?.services?.get(servicioId)?.name || servicioId
    : "";
  const areaName = areaId ? lookups?.areas?.get(areaId)?.name || areaId : "";
  const puertoName = puertoId ? lookups?.ports?.get(puertoId)?.name || puertoId : "";

  const lugar = puertoName || areaName;

  // --- Plantillas fijas
  let h1 = "Resultados";
  let title = "Buscar | NautiCards";
  let description =
    "Encuentra empresas y servicios náuticos. Directorio con información de contacto y ubicación.";

  if (servicioName && lugar) {
    h1 = `${servicioName} en ${lugar}`;
    title = `${servicioName} en ${lugar} | NautiCards`;
    description = `Encuentra empresas de ${servicioName} en ${lugar}. Directorio de servicios náuticos con información de contacto y ubicación.`;
  } else if (servicioName) {
    h1 = `Empresas de ${servicioName}`;
    title = `Empresas de ${servicioName} | NautiCards`;
    description = `Encuentra empresas de ${servicioName}. Directorio de servicios náuticos con información de contacto y ubicación.`;
  } else if (lugar) {
    h1 = `Empresas náuticas en ${lugar}`;
    title = `Empresas náuticas en ${lugar} | NautiCards`;
    description = `Encuentra empresas náuticas en ${lugar}. Directorio con información de contacto y ubicación.`;
  }

  // Robots: conservador
  // - q libre: noindex
  // - sin filtros útiles: noindex
  // - sin resultados: noindex
  const hasUseful = Boolean(servicioId || puertoId || areaId);
  const robots =
    (q && q.length >= 1) ||
    !hasUseful ||
    (typeof total === "number" && total === 0)
      ? "noindex,follow"
      : "index,follow";

  // Aplicar
  document.title = title;
  ensureMeta("description").setAttribute("content", description);
  ensureMeta("robots").setAttribute("content", robots);
  ensureCanonical().setAttribute("href", buildBuscarCanonical(filters));

  // H1 visible (tu buscar tiene h1.page-title)
  const h1El = document.querySelector("h1.page-title");
  if (h1El) h1El.textContent = h1;
}

/**
 * SEO para la página /pages/empresa/
 * Manteniendo URL actual con query params.
 *
 * Llamada recomendada:
 * updateEmpresaSEO({
 *   company,
 *   seoPortName,   // string opcional (p.ej. "Port Fòrum" o "Barcelona")
 *   idParam,       // valor del query param id (si existe)
 *   slugParam      // valor del query param slug (si existe)
 * })
 */
export function updateEmpresaSEO({ company, seoPortName, idParam, slugParam }) {
  // Si no hay company (error, id inválido, etc.) => no indexar
  if (!company) {
    document.title = "Empresa | NautiCards";
    ensureMeta("description").setAttribute(
      "content",
      "Ficha de empresa en el directorio náutico."
    );
    ensureMeta("robots").setAttribute("content", "noindex,follow");
    ensureCanonical().setAttribute("href", new URL("pages/empresa/", SITE_ROOT).href);
    return;
  }

  const name = (company?.name || company?.title || "Empresa").toString().trim();
  const lugar = (seoPortName || "").toString().trim();
  const placePart = lugar ? ` en ${lugar}` : "";

  // Plantilla fija (como en buscar)
  const title = `${name}${placePart} | NautiCards`;
  const description = `Encuentra información de ${name}${placePart}. Directorio de servicios náuticos con información de contacto y ubicación.`;

  document.title = title;
  ensureMeta("description").setAttribute("content", description);
  ensureMeta("robots").setAttribute("content", "index,follow");

  // Canonical estable (preferimos id)
  ensureCanonical().setAttribute(
    "href",
    buildEmpresaCanonical({ idParam, slugParam })
  );

  // (Opcional) si tu empresa tiene h1.page-title o un h1 específico
  const h1El = document.querySelector("h1.page-title");
  if (h1El) h1El.textContent = name;
}