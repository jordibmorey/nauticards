export const SITE_ROOT = new URL("../../", import.meta.url); // raíz del sitio
export const PAGE_SIZE = 8;

export const API_BASE = location.hostname === "localhost" || location.hostname === "127.0.0.1" ? "https://nauticards.es"  : "";



export const DATA = {
  companies: new URL("data/companies", SITE_ROOT).href,
  services: new URL("data/services", SITE_ROOT).href,
  ports: new URL("data/ports", SITE_ROOT).href,
  regions: new URL("data/regions", SITE_ROOT).href,
  areas: new URL("data/areas", SITE_ROOT).href,
};