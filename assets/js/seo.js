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

function getLang() {
  // Prioridad: <html lang="..">, luego localStorage
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang.startsWith("en")) return "en";
  if (htmlLang.startsWith("es")) return "es";

  const ls = (localStorage.getItem("lang") || localStorage.getItem("language") || "").toLowerCase();
  if (ls.startsWith("en")) return "en";
  return "es";
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
  // canonical estable: prioriza ID
  if (idParam) base.searchParams.set("id", String(idParam));
  else if (slugParam) base.searchParams.set("slug", String(slugParam));
  return base.href;
}

function pickName(obj, fallback) {
  // Si en el futuro metes name_i18n, aquí es donde lo aprovecharías
  // por ahora tiramos de .name
  return (obj?.name || fallback || "").toString().trim();
}

/**
 * SEO para /pages/buscar/
 */
export function updateBuscarSEO({ filters, lookups, total }) {
  const lang = getLang();

  const servicioId = (filters?.servicio || "").toString().trim();
  const areaId = (filters?.area || "").toString().trim();
  const puertoId = (filters?.puerto || "").toString().trim();
  const q = (filters?.q || "").toString().trim();

  const servicioObj = servicioId ? lookups?.services?.get(servicioId) : null;
  const areaObj = areaId ? lookups?.areas?.get(areaId) : null;
  const puertoObj = puertoId ? lookups?.ports?.get(puertoId) : null;

  const servicioName = servicioId ? pickName(servicioObj, servicioId) : "";
  const areaName = areaId ? pickName(areaObj, areaId) : "";
  const puertoName = puertoId ? pickName(puertoObj, puertoId) : "";

  const lugar = puertoName || areaName;

  // --- Plantillas fijas ES/EN
  let h1, title, description;

  if (lang === "en") {
    h1 = "Results";
    title = "Search | NautiCards";
    description = "Find nautical companies and services. Directory with contact details and location.";

    if (servicioName && lugar) {
      h1 = `${servicioName} in ${lugar}`;
      title = `${servicioName} in ${lugar} | NautiCards`;
      description = `Find ${servicioName} companies in ${lugar}. Nautical services directory with contact details and location.`;
    } else if (servicioName) {
      h1 = `${servicioName} companies`;
      title = `${servicioName} companies | NautiCards`;
      description = `Find ${servicioName} companies. Nautical services directory with contact details and location.`;
    } else if (lugar) {
      h1 = `Nautical companies in ${lugar}`;
      title = `Nautical companies in ${lugar} | NautiCards`;
      description = `Find nautical companies in ${lugar}. Directory with contact details and location.`;
    }
  } else {
    h1 = "Resultados";
    title = "Buscar | NautiCards";
    description = "Encuentra empresas y servicios náuticos. Directorio con información de contacto y ubicación.";

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
  }

  // Robots: conservador
  const hasUseful = Boolean(servicioId || puertoId || areaId);
  const robots =
    (q && q.length >= 1) || !hasUseful || (typeof total === "number" && total === 0)
      ? "noindex,follow"
      : "index,follow";

  document.title = title;
  ensureMeta("description").setAttribute("content", description);
  ensureMeta("robots").setAttribute("content", robots);
  ensureCanonical().setAttribute("href", buildBuscarCanonical(filters));

  const h1El = document.querySelector("h1.page-title");
  if (h1El) h1El.textContent = h1;
}

/**
 * SEO para /pages/empresa/
 * - Usa el MISMO esquema ES/EN, sin frases por servicio.
 */
export function updateEmpresaSEO({ company, seoPortName, idParam, slugParam }) {
  const lang = getLang();

  // si no hay empresa => noindex
  if (!company) {
    document.title = lang === "en" ? "Company | NautiCards" : "Empresa | NautiCards";
    ensureMeta("description").setAttribute(
      "content",
      lang === "en"
        ? "Company profile in the nautical directory."
        : "Ficha de empresa en el directorio náutico."
    );
    ensureMeta("robots").setAttribute("content", "noindex,follow");
    ensureCanonical().setAttribute("href", new URL("pages/empresa/", SITE_ROOT).href);
    return;
  }

  const name = (company?.name || company?.title || "Empresa").toString().trim();
  const lugar = (seoPortName || "").toString().trim();
  const placePart =
    lugar ? (lang === "en" ? ` in ${lugar}` : ` en ${lugar}`) : "";

  const title = `${name}${placePart} | NautiCards`;
  const description =
    lang === "en"
      ? `Find information about ${name}${placePart}. Nautical services directory with contact details and location.`
      : `Encuentra información de ${name}${placePart}. Directorio de servicios náuticos con información de contacto y ubicación.`;

  document.title = title;
  ensureMeta("description").setAttribute("content", description);
  ensureMeta("robots").setAttribute("content", "index,follow");
  ensureCanonical().setAttribute("href", buildEmpresaCanonical({ idParam, slugParam }));

  const h1El = document.querySelector("h1.page-title");
  if (h1El) h1El.textContent = name;
}