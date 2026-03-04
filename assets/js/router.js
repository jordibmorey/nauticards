import { initHomePage } from "./pages/home.js";
import { initCompanyPage } from "./pages/company.js";
import { initServicesPage } from "./pages/services.js";
import { initPortsPage } from "./pages/ports.js";

const routes = {
  home: initHomePage,
  buscar: initHomePage,
  company: initCompanyPage,
  servicios: initServicesPage,
  puertos: initPortsPage,
};

export function runRouter() {
  const page = document.body?.dataset?.page || "home";
  const fn = routes?.[page] || routes.home;
  return fn?.();
}

export function rerenderCurrentPage() {
  return runRouter();
}
