import { API_BASE } from "./config.js";
import { trDb } from "./utils.js";


async function getCompanies() {
  // ✅ LITE: índice mínimo (para puertos/servicios)
  const r = await fetch(`${API_BASE}/api/companies?mode=lite&lang=${window.__lang || "es"}`);
  if (!r.ok) throw new Error(`Worker companies(lite) -> HTTP ${r.status}`);
  return r.json();
}


async function getCompany({ id = "", slug = "" } = {}) {
  const u = new URL(`${(API_BASE || window.location.origin)}/api/company`);
  u.searchParams.set("lang", window.__lang || "es");

  if (id) u.searchParams.set("id", id);
  else if (slug) u.searchParams.set("slug", slug);
  else throw new Error("getCompany: missing id/slug");

  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(`Worker company -> HTTP ${r.status}`);
  return r.json();
}



async function getCompaniesPaged({ q = "", servicio = "", puerto = "", page = 1, pageSize = 8 } = {}) {
  const u = new URL(`${(API_BASE || window.location.origin)}/api/companies`);
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


export {
  getCompanies, getCompany, getCompaniesPaged,
  getServices, getPServices, getPorts, getRegions, getAreas
};
