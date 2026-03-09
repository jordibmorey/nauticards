import { SITE_ROOT } from "../config.js";
import { getPorts, getPServices, getCompanies, getAreas } from "../dal.js";
import { safeText, safeAttr, indexById, sortByName, normalize, tr } from "../utils.js";

const PORT_SERVICE_ICON_BY_ID = {
  "agua": "droplet",
  "alquiler-coches": "car",
  "aseos": "bath",
  "bicicletas": "bike",
  "carburante": "fuel",
  "duchas": "shower-head",
  "electricidad": "zap",
  "grua-elevacion": "layers-2",
  "lavanderia": "shirt",
  "rampa-botadura": "move-up-right",
  "reciclaje": "recycle",
  "recuperacion-aguas-residuales": "waves",
  "venta-hielo": "snowflake",
  "videovigilancia": "cctv",
  "vigilante-nocturno": "shield",
  "wifi": "wifi"
};

function getPortServiceIconById(serviceId = "") {
  return PORT_SERVICE_ICON_BY_ID[String(serviceId).trim()] || "anchor";
}


export async function initPortsPage() {
  // ANTES: const searchEl = document.getElementById("portsSearch");
  // AHORA:
  const areaEl = document.getElementById("portsArea");
  const selectEl = document.getElementById("portsSelect");

  // Panel derecho (detalle)
  const nameEl = document.getElementById("portName");
  const heroImgEl = document.getElementById("portHeroImg");
  const descEl = document.getElementById("portDescription");
  const servicesEl = document.getElementById("portServices");
  const mapEl = document.getElementById("portMap");
  const browseLinkEl = document.getElementById("portBrowseLink");
  const detailPanelEl = document.getElementById("portDetailPanel");


  // ANTES: const mapExternalEl = document.getElementById("portMapExternal");
  // AHORA:
  const webExternalEl = document.getElementById("portWebExternal");

  // Contacto (NUEVO)
  const websiteEl = document.getElementById("portWebsite");
  const emailRowEl = document.getElementById("portEmailRow");
  const emailEl = document.getElementById("portEmail");
  const phoneRowEl = document.getElementById("portPhoneRow");
  const phoneEl = document.getElementById("portPhone");

  // Si no estamos en esta página, salir sin romper nada
  if (!areaEl || !selectEl || !nameEl || !heroImgEl || !descEl || !servicesEl || !mapEl || !browseLinkEl) return;

  const PLACEHOLDER = new URL("assets/img/placeholder.webp", SITE_ROOT).href;

  const UI_DEFAULTS = {
  portName: nameEl.textContent,
  portDesc: descEl.textContent,
  browseText: browseLinkEl.textContent,
  websiteDash: websiteEl ? websiteEl.textContent : "—",
};

  // Normaliza string: minúsculas + quita tildes/diacríticos + recorta espacios
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // diacríticos
      .toLowerCase()
      .trim();

  const openSelect = (selectEl) => {
    // Truco cross-browser para abrir el select
    const evt = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    selectEl.dispatchEvent(evt);
  };

    const isMobileLayout = () => window.matchMedia("(max-width: 1023px)").matches;

  const scrollToPortDetail = () => {
    const headerEl = document.querySelector(".site-header");
    const targetEl =
      heroImgEl?.closest(".bg-white.rounded-xl.shadow-sm.border.border-gray-100.overflow-hidden") ||
      heroImgEl;

    if (!targetEl) return;

    const headerOffset = (headerEl?.offsetHeight || 0) + 12;
    const top = targetEl.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({
      top,
      behavior: "smooth",
    });
  };

  let portsList = [];
  let servicesList = [];
  let companies = [];
  let areasList = [];

  try {
    [portsList, servicesList, companies, areasList] = await Promise.all([getPorts(), getPServices(), getCompanies(), getAreas()]);
  } catch (e) {
    console.error(e);
    selectEl.innerHTML = `<option value="">${tr("ports.errorLoading", "— Error cargando puertos —")}</option>`;
    return;
  }

  const servicesById = indexById(servicesList);

  // Count companies per port (primary + secondary)
  const counts = new Map();
  for (const c of companies || []) {
    const ids = [];
    if (c.port_id != null) ids.push(String(c.port_id));
    if (Array.isArray(c.secondary_port_ids)) ids.push(...c.secondary_port_ids.map(String));
    for (const pid of ids) counts.set(pid, (counts.get(pid) || 0) + 1);
  }

  const getPortIdFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") || params.get("puerto") || "";
  };

  const getAreaIdFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("area") || "";
  };

  const makeOsmEmbedUrl = (lat, lon) => {
    const delta = 0.01;
    const left = lon - delta;
    const right = lon + delta;
    const bottom = lat - delta;
    const top = lat + delta;

    const u = new URL("https://www.openstreetmap.org/export/embed.html");
    u.searchParams.set("bbox", `${left},${bottom},${right},${top}`);
    u.searchParams.set("layer", "mapnik");
    u.searchParams.set("marker", `${lat},${lon}`);
    return u.toString();
  };

  // NUEVO: Botón "Abrir web"
  const setExternalWebLink = (url) => {
    if (!webExternalEl) return;
    webExternalEl.href = url;
    webExternalEl.classList.remove("is-disabled");
    webExternalEl.removeAttribute("aria-disabled");
  };

  const resetExternalWebLink = () => {
    if (!webExternalEl) return;
    webExternalEl.href = "#";
    webExternalEl.classList.add("is-disabled");
    webExternalEl.setAttribute("aria-disabled", "true");
  };

  const renderPortDetail = (p) => {
  // Si no hay puerto → ocultar panel entero
if (!p) {
  if (detailPanelEl) detailPanelEl.hidden = true;

  nameEl.textContent = tr("ports.select.title", UI_DEFAULTS.portName);
  heroImgEl.src = PLACEHOLDER;
  heroImgEl.alt = "";
  descEl.textContent = tr("ports.select.text", UI_DEFAULTS.portDesc);

  servicesEl.innerHTML = `<li><span class="tag">—</span></li>`;

  mapEl.src =
    "https://www.openstreetmap.org/export/embed.html?bbox=2.150%2C41.350%2C2.190%2C41.390&layer=mapnik";

  browseLinkEl.href = "../buscar/index.html";
  browseLinkEl.textContent = tr("ports.viewCompanies", UI_DEFAULTS.browseText);

  resetExternalWebLink();

  if (websiteEl) {
    websiteEl.textContent = UI_DEFAULTS.websiteDash; // normalmente "—"
    websiteEl.href = "#";
    websiteEl.classList.add("is-disabled");
    websiteEl.setAttribute("aria-disabled", "true");
  }

  if (emailRowEl) emailRowEl.style.display = "none";
  if (phoneRowEl) phoneRowEl.style.display = "none";

 /* ===== SEO: estado "sin puerto" (i18n) ===== */
{
  document.title = tr("meta.ports.title", "Ports | NautiCards");

  const desc = tr(
    "meta.ports.description",
    "Explore ports and marinas and discover nautical companies and services on NautiCards."
  );

  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", desc);
}

/* ===== OPEN GRAPH / TWITTER - PORTS (sin puerto) ===== */
{
  const setPropMeta = (property, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", property);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const setNameMeta = (name, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const ogTitle = document.title;
  const ogDescription =
    document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  const ogUrl = window.location.href;
  const ogImage = "https://nauticards.es/assets/img/hero.webp";

  setPropMeta("og:title", ogTitle);
  setPropMeta("og:description", ogDescription);
  setPropMeta("og:type", "website");
  setPropMeta("og:url", ogUrl);
  setPropMeta("og:image", ogImage);

  setNameMeta("twitter:card", "summary_large_image");
  setNameMeta("twitter:title", ogTitle);
  setNameMeta("twitter:description", ogDescription);
  setNameMeta("twitter:image", ogImage);
}


  return;
}


  // Hay puerto → mostrar panel
  if (detailPanelEl) detailPanelEl.hidden = false;


  const id = String(p.id);
  const name = p.name || id;

  /* ===== SEO: puerto seleccionado (i18n) ===== */
{
  const seoPortName = (name || "").trim();

  const titleTpl = tr(
    "meta.ports.detailTitle",
    "{port} | Port | NautiCards"
  );
  document.title = titleTpl.replace("{port}", seoPortName);

  const descTpl = tr(
    "meta.ports.detailDescription",
    "{port}: port info and contact. Discover associated nautical companies and services on NautiCards."
  );

  const desc = descTpl.replace("{port}", seoPortName);

  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", desc);
}

/* ===== OPEN GRAPH / TWITTER - PORT DETAIL ===== */
{
  const setPropMeta = (property, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("property", property);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const setNameMeta = (name, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[name="${name}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  };

  const ogTitle = document.title;
  const ogDescription =
    document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

  const ogUrl = window.location.href;

  // ports.json tiene image_url (a veces vacío)
  const ogImage = (p?.image_url || "").trim() || "https://nauticards.es/assets/img/hero.webp";

  setPropMeta("og:title", ogTitle);
  setPropMeta("og:description", ogDescription);
  setPropMeta("og:type", "website");
  setPropMeta("og:url", ogUrl);
  setPropMeta("og:image", ogImage);

  setNameMeta("twitter:card", "summary_large_image");
  setNameMeta("twitter:title", ogTitle);
  setNameMeta("twitter:description", ogDescription);
  setNameMeta("twitter:image", ogImage);
}




  // Hero
  const imgUrl = p.image_url ? String(p.image_url) : PLACEHOLDER;
  nameEl.textContent = name;
  heroImgEl.src = imgUrl;
  heroImgEl.alt = "";
  heroImgEl.onerror = () => {
    heroImgEl.onerror = null;
    heroImgEl.src = PLACEHOLDER;
  };

  // Descripción
  descEl.textContent = p.description ? String(p.description) : "Sin descripción disponible por ahora.";

  // ---- Contacto ----
  if (websiteEl) {
    if (p.website) {
      websiteEl.textContent = String(p.website).replace(/^https?:\/\//, "");
      websiteEl.href = String(p.website);
      websiteEl.classList.remove("is-disabled");
      websiteEl.removeAttribute("aria-disabled");
      setExternalWebLink(String(p.website));
    } else {
      websiteEl.textContent = "—";
      websiteEl.href = "#";
      websiteEl.classList.add("is-disabled");
      websiteEl.setAttribute("aria-disabled", "true");
      resetExternalWebLink();
    }
  } else {
    if (!p.website) resetExternalWebLink();
    else setExternalWebLink(String(p.website));
  }

  if (emailRowEl && emailEl) {
    if (p.email) {
      emailRowEl.style.display = "";
      emailEl.textContent = String(p.email);
      emailEl.href = `mailto:${String(p.email)}`;
    } else {
      emailRowEl.style.display = "none";
    }
  }

  if (phoneRowEl && phoneEl) {
    if (p.phone) {
      phoneRowEl.style.display = "";

      // Mostrar bonito
      const displayPhone = p.phone_raw || p.phone;
      phoneEl.textContent = displayPhone;

      // Limpiar para tel:
      const clean = String(p.phone).replace(/[^\d+]/g, "");
      phoneEl.href = `tel:${clean}`;
    } else {
      phoneRowEl.style.display = "none";
    }
  }

  // Servicios (chips)
  const sIds = Array.isArray(p.service_ids) ? p.service_ids.map(String) : [];
  if (!sIds.length) {
    servicesEl.innerHTML = `
  <li class="port-service-chip">
    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
      —
    </span>
  </li>
`;
  } else {
    servicesEl.innerHTML = sIds
      .map((sid) => {
        const s = servicesById.get(String(sid));
        const label = s?.name || sid;
        const icon = getPortServiceIconById(s?.id || sid);

        return `
  <li class="port-service-chip">
    <span class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700">
      <i data-lucide="${safeAttr(icon)}" class="w-4 h-4 mr-1.5 text-gray-500"></i>
      ${safeText(label)}
    </span>
  </li>
`;
      })
      .join("");

    if (window.lucide) window.lucide.createIcons();

  }

  // Link a buscar filtrado por puerto
  browseLinkEl.href = `../buscar/index.html?puerto=${encodeURIComponent(id)}`;

  // Mapa (si hay lat/lon)
  const lat = p.lat ?? p.latitude;
  const lon = p.lon ?? p.longitude;

  if (typeof lat === "number" && typeof lon === "number" && isFinite(lat) && isFinite(lon)) {
    mapEl.src = makeOsmEmbedUrl(lat, lon);
  } else {
    mapEl.src =
      "https://www.openstreetmap.org/export/embed.html?bbox=2.150%2C41.350%2C2.190%2C41.390&layer=mapnik";
  }
};


  const sortPorts = (arr) =>
  (arr || []).slice().sort(sortByName);

// ✅ En /api/ports tu worker añade "pseudoPorts" de cities con suffix "(Ciudad)/(City)"
// ✅ Queremos ocultarlos SOLO en la página Puertos.
const isCityPseudoPort = (p) => {
  const d = String(p?.description || "");
  return /\s\((Ciudad|City)\)\s*$/i.test(d);
};

const allPorts = sortPorts((portsList || []).filter((p) => !isCityPseudoPort(p)));


  const findPortById = (id) => allPorts.find((p) => String(p.id) === String(id));

  let currentId = getPortIdFromURL();
  let currentAreaId = getAreaIdFromURL();

  const renderAreas = () => {
    const opts = (areasList || [])
      .slice()
      .sort(sortByName)
      .map((a) => `<option value="${safeAttr(a.id)}">${safeText(a.name || a.id)}</option>`)
      .join("");

    areaEl.innerHTML = `<option value="">${tr("common.any", "Cualquiera")}</option>${opts}`;

    if (currentAreaId) areaEl.value = currentAreaId;
  };

  // si vienes con ?id=... y no hay area, la deducimos del puerto
  if (currentId && !currentAreaId) {
    const p = findPortById(currentId);
    if (p?.area_id != null) currentAreaId = String(p.area_id);
  }

  const renderSelect = (filtered, selectedId) => {
    selectEl.innerHTML = `<option value="">${tr("ports.dropdownPlaceholder", "— Selecciona un puerto —")}</option>`;


    for (const p of filtered) {
      const opt = document.createElement("option");
      opt.value = String(p.id);

      const n = counts.get(String(p.id)) || 0;
      const label = p.name || String(p.id);
      opt.textContent = `${label}${n ? ` (${n})` : ""}`;

      if (String(p.id) === String(selectedId)) opt.selected = true;
      selectEl.appendChild(opt);
    }
  };

  const applyFilterAndRender = () => {
    currentAreaId = areaEl.value || currentAreaId || "";
    const filtered = !currentAreaId ? allPorts : allPorts.filter((p) => String(p.area_id || "") === String(currentAreaId));

    if (currentId && !filtered.some((p) => String(p.id) === String(currentId))) currentId = "";

    renderSelect(filtered, currentId);
    renderPortDetail(currentId ? findPortById(currentId) : null);
  };

  if (areaEl) {
    areaEl.addEventListener("change", () => {
      currentAreaId = areaEl.value || "";
      currentId = "";
      applyFilterAndRender();
      if (selectEl.options.length > 1) openSelect(selectEl);
    });
  }

    selectEl.addEventListener("change", () => {
    currentId = selectEl.value || "";
    applyFilterAndRender();

    if (currentId && isMobileLayout()) {
      requestAnimationFrame(() => {
        setTimeout(scrollToPortDetail, 60);
      });
    }
  });

  // Render inicial
  renderAreas();
  applyFilterAndRender();
  window.addEventListener("i18n:ready", () => {
  renderAreas();
  applyFilterAndRender();
}, { once: true });

}