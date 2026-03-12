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

function ensureHreflang(rel, href) {
  let el = document.querySelector(`link[rel="alternate"][hreflang="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "alternate");
    el.setAttribute("hreflang", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function getLang() {
  const htmlLang = (document.documentElement.lang || "").toLowerCase();
  if (htmlLang.startsWith("en")) return "en";
  if (htmlLang.startsWith("es")) return "es";

  const ls = (localStorage.getItem("lang") || localStorage.getItem("language") || "").toLowerCase();
  if (ls.startsWith("en")) return "en";
  return "es";
}

function buildBuscarCanonical(filters) {
  const lang = getLang();
  const params = new URLSearchParams();

  const servicio = (filters?.servicio || "").toString().trim();
  const area = (filters?.area || "").toString().trim();
  const puerto = (filters?.puerto || "").toString().trim();
  const page = (filters?.page || "").toString().trim();

  if (lang === "en") params.set("lang", "en");
  if (servicio) params.set("servicio", servicio);
  if (area) params.set("area", area);
  if (puerto) params.set("puerto", puerto);
  if (page && page !== "1") params.set("page", page);

  const base = new URL("buscar/", SITE_ROOT).href;
  return params.toString() ? `${base}?${params.toString()}` : base;
}

function buildEmpresaCanonical({ idParam, slugParam }) {
  const lang = getLang();
  const base = new URL("empresa/", SITE_ROOT);

  if (lang === "en") base.searchParams.set("lang", "en");

  if (idParam) base.searchParams.set("id", String(idParam));
  else if (slugParam) base.searchParams.set("slug", String(slugParam));

  return base.href;
}

function pickName(obj, fallback) {
  return (obj?.name || fallback || "").toString().trim();
}

/**
 * SEO para /buscar/
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

  const hasStrongSEO = Boolean(servicioId && (puertoId || areaId));
  const robots =
    (q && q.length >= 1) ||
    (typeof total === "number" && total === 0) ||
    !hasStrongSEO
      ? "noindex,follow"
      : "index,follow";

  document.title = title;
  ensureMeta("description").setAttribute("content", description);
  ensureMeta("robots").setAttribute("content", robots);

  const canonical = buildBuscarCanonical(filters);
  ensureCanonical().setAttribute("href", canonical);

  // hreflang
  const esUrl = new URL("buscar/", SITE_ROOT);
  const enUrl = new URL("buscar/", SITE_ROOT);
  enUrl.searchParams.set("lang", "en");

  ensureHreflang("es", esUrl.href);
  ensureHreflang("en", enUrl.href);
  ensureHreflang("x-default", esUrl.href);

  const h1El = document.querySelector("h1.page-title");
  if (h1El) h1El.textContent = h1;
}

/**
 * SEO para /empresa/
 */
export function updateEmpresaSEO({ company, seoPortName, idParam, slugParam }) {
  const lang = getLang();

  if (!company) {
    document.title = lang === "en" ? "Company | NautiCards" : "Empresa | NautiCards";

    ensureMeta("description").setAttribute(
      "content",
      lang === "en"
        ? "Company profile in the nautical directory."
        : "Ficha de empresa en el directorio náutico."
    );

    ensureMeta("robots").setAttribute("content", "noindex,follow");

    const esUrl = new URL("empresa/", SITE_ROOT);
    const enUrl = new URL("empresa/", SITE_ROOT);
    enUrl.searchParams.set("lang", "en");

    ensureCanonical().setAttribute("href", esUrl.href);

    ensureHreflang("es", esUrl.href);
    ensureHreflang("en", enUrl.href);
    ensureHreflang("x-default", esUrl.href);

    return;
  }

  const name = (company?.name || company?.title || "Empresa").toString().trim();
  const lugar = (seoPortName || "").toString().trim();
  const placePart = lugar ? (lang === "en" ? ` in ${lugar}` : ` en ${lugar}`) : "";

  const title = `${name}${placePart} | NautiCards`;

  const description =
    lang === "en"
      ? `Find information about ${name}${placePart}. Nautical services directory with contact details and location.`
      : `Encuentra información de ${name}${placePart}. Directorio de servicios náuticos con información de contacto y ubicación.`;

  document.title = title;
  ensureMeta("description").setAttribute("content", description);
  ensureMeta("robots").setAttribute("content", "index,follow");

  const canonical = buildEmpresaCanonical({ idParam, slugParam });
  ensureCanonical().setAttribute("href", canonical);

  const esUrl = new URL("empresa/", SITE_ROOT);
  const enUrl = new URL("empresa/", SITE_ROOT);
  enUrl.searchParams.set("lang", "en");

  if (idParam) {
    esUrl.searchParams.set("id", idParam);
    enUrl.searchParams.set("id", idParam);
  } else if (slugParam) {
    esUrl.searchParams.set("slug", slugParam);
    enUrl.searchParams.set("slug", slugParam);
  }

  ensureHreflang("es", esUrl.href);
  ensureHreflang("en", enUrl.href);
  ensureHreflang("x-default", esUrl.href);

  const h1El = document.querySelector("h1.page-title");
  if (h1El) h1El.textContent = name;
}