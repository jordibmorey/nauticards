import { SITE_ROOT } from "../config.js";
import { getCompany, getServices, getPorts, getRegions, getAreas } from "../dal.js";
import { safeText, safeAttr, sanitizeUrl, indexById, tr } from "../utils.js";
import { updateEmpresaSEO } from "../seo.js";

const SERVICE_ICON_MAP = {
  "acero": "hammer",
  "aislamiento-termico": "shield",
  "amarres": "anchor",
  "andamiaje": "construction",
  "anticontaminacion": "shield-alert",
  "antifouling-pintura": "paintbrush",
  "asesoria": "briefcase",
  "astillero": "ship",
  "barnices": "paintbrush-vertical",
  "baterias": "battery",
  "bunkering": "fuel",
  "carpinteria": "ruler",
  "charter": "sailboat",
  "club-nautico": "sailboat",
  "cristal-metacrilato": "panel-top",
  "electrotecnia": "zap",
  "escuela-nautica": "graduation-cap",
  "fibra": "layers",
  "fontaneria": "cylinder",
  "gestoria": "file-text",
  "helices": "fan",
  "hidraulica": "droplets",
  "hvac": "wind",
  "inox": "wrench",
  "invernaje": "warehouse",
  "limpieza-pulido": "sparkles",
  "marina": "map",
  "mecanica": "cog",
  "peritaje": "search-check",
  "project-management": "clipboard-list",
  "protecciones-de-pintura": "shield-plus",
  "pupilaje": "house",
  "refits-integrales": "hammer",
  "rigging": "anchor",
  "seguros": "shield",
  "semirrigidas": "boat",
  "soldadura-corte": "flame",
  "tapiceria": "sofa",
  "teka-cubierta": "grid-2x2",
  "tienda-nautica": "shopping-bag",
  "transmision": "settings-2",
  "traslados": "truck",
  "tratamiento-de-osmosis": "droplets",
  "varaderos": "ship-wheel",
  "veleria": "sailboat",
  "venta-de-embarcaciones": "badge-euro"
};

export async function initCompanyPage() {
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("id");
  const slugParam = params.get("slug");

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  };

  try {
    const [company, servicesList, portsList, regionsList, areasList] = await Promise.all([
      getCompany({ id: idParam || "", slug: slugParam || "" }),
      getServices(),
      getPorts(),
      getRegions(),
      getAreas(),
    ]);

    const servicesById = indexById(servicesList);
    const portsById = indexById(portsList);
    const regionsById = regionsList ? indexById(regionsList) : null;
    // areasList lo dejas cargado por si lo usas más adelante (ahora mismo no lo estabas usando aquí)
    void areasList;

    if (!company) {
      setText("company-name", tr("company.notFound", "Empresa no encontrada"));

      // ✅ SEO: si no existe, noindex + canonical base
      updateEmpresaSEO({ company: null, seoPortName: "", idParam, slugParam });

      return;
    }

    // ==== SEO dinámico empresa (igual filosofía que buscar) ====
    const seoPortObj =
      (company?.port_id != null ? portsById.get(String(company.port_id)) : null) || null;

    const seoPortName = (seoPortObj?.name || "").trim();

    // ✅ SEO completo (title/description/robots/canonical)
    updateEmpresaSEO({ company, seoPortName, idParam, slugParam });

    // ==== Open Graph / Twitter (mantengo lo tuyo, pero mejor canonical/og:url) ====
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

      // Usa canonical como og:url (más estable que window.location.href)
      const canonicalHref =
        document.querySelector('link[rel="canonical"]')?.getAttribute("href") || window.location.href;

      let ogImage = (company?.logo || "").trim();
      if (ogImage.startsWith("//")) ogImage = `https:${ogImage}`;
      if (!ogImage) ogImage = "https://nauticards.es/assets/img/hero.webp";

      setPropMeta("og:title", ogTitle);
      setPropMeta("og:description", ogDescription);
      setPropMeta("og:type", "website");
      setPropMeta("og:url", canonicalHref);
      setPropMeta("og:image", ogImage);

      setNameMeta("twitter:card", "summary_large_image");
      setNameMeta("twitter:title", ogTitle);
      setNameMeta("twitter:description", ogDescription);
      setNameMeta("twitter:image", ogImage);
    }

    // ==== Render ====
    setText("company-name", company.name || "");
    setText("company-subtitle", company.slug ? company.slug : "");
    setText("company-description", company.description || "");

    // Servicios

    const servicesEl = document.getElementById("company-services");
    if (servicesEl) {
      const sIds = Array.isArray(company.service_ids) ? company.service_ids.map(String) : [];

      if (!sIds.length) {
        servicesEl.innerHTML = `
          <div class="rounded-2xl border border-border bg-[#f6f7f8] px-5 py-4 text-sm text-textMuted sm:col-span-2">
            —
          </div>
        `;
      } else {
        servicesEl.innerHTML = sIds
          .map((sid) => {
            const s = servicesById.get(String(sid));
            const label = s?.name || sid;
            const icon = SERVICE_ICON_MAP[sid] || "settings";

            return `
              <div class="rounded-2xl border border-border bg-[#f6f7f8] px-4 py-3.5">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-white border border-border shadow-soft flex items-center justify-center shrink-0 text-primary">
                    <i data-lucide="${safeAttr(icon)}" class="w-4 h-4"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="font-medium text-sm leading-snug text-textMain">
                      ${safeText(label)}
                    </div>
                  </div>
                </div>
              </div>
            `;
          })
          .join("");

        if (window.lucide) window.lucide.createIcons();
      }
    }

    // Port / address / contact
    const portName =
      company.port_id != null ? portsById.get(String(company.port_id))?.name || "—" : "—";

    const secPorts = Array.isArray(company.secondary_port_ids) ? company.secondary_port_ids : [];
    const secNames = secPorts
      .map((pid) => portsById.get(String(pid))?.name)
      .filter(Boolean);

    const secEl = document.getElementById("company-secondary-ports");
    if (secEl) {
      secEl.textContent = secNames.length ? secNames.join(", ") : "—";
    }

    setText("company-port", portName);
    setText("company-location", company.address || "—");
    setText("company-address", company.address || "—");
    setText("company-phone", company.phone || "—");
    setText("company-email", company.email || "—");

    // Mapa
    const mapEl = document.getElementById("company-map");
    if (mapEl) {
      const p = company.port_id != null ? portsById.get(String(company.port_id)) : null;

      const cLat = company.lat != null ? Number(company.lat) : null;
      const cLng = company.lng != null ? Number(company.lng) : null;

      const lat = Number.isFinite(cLat) ? cLat : p?.lat;
      const lon = Number.isFinite(cLng) ? cLng : p?.lon;

      if (typeof lat === "number" && typeof lon === "number") {
        const delta = 0.01;
        const left = lon - delta;
        const right = lon + delta;
        const bottom = lat - delta;
        const top = lat + delta;

        const u = new URL("https://www.openstreetmap.org/export/embed.html");
        u.searchParams.set("bbox", `${left},${bottom},${right},${top}`);
        u.searchParams.set("layer", "mapnik");
        u.searchParams.set("marker", `${lat},${lon}`);

        mapEl.src = u.toString();
      }
    }

    // Logo
const logoImg = document.getElementById("company-logo");
const logoMobile = document.getElementById("company-logo-mobile");   // ← AÑADIR

if (logoImg) {
  const src = sanitizeUrl(company.logo);
  if (src) {
    logoImg.src = src;
    logoImg.alt = company.name || "Logo";

    if (logoMobile) {                    // ← AÑADIR
      logoMobile.src = src;
      logoMobile.alt = company.name || "Logo";
    }

  } else {
    const wrap = logoImg.closest(".company-header__logo");
    if (wrap) wrap.style.display = "none";
  }
}

    const webEl = document.getElementById("company-web");
    if (webEl) {
      const url = sanitizeUrl(company.website);
      webEl.innerHTML = url
        ? `<a href="${safeAttr(url)}" target="_blank" rel="noopener">${safeText(url)}</a>`
        : "—";
    }

    const contactBtn = document.getElementById("company-contact-btn");
    if (contactBtn) {
      const email = (company.email || "").toString().trim();
      if (email) {
        contactBtn.setAttribute("href", `mailto:${email}`);
        contactBtn.classList.remove("is-hidden");
      } else {
        contactBtn.classList.add("is-hidden");
      }
    }

    const fixBtn = document.getElementById("company-fix-btn");
    if (fixBtn) {
      fixBtn.setAttribute("href", new URL("pages/contacto/index.html", SITE_ROOT).href);
    }

    // Region
    const regionEl = document.getElementById("company-region");
    if (regionEl && regionsById) {
      const regionName =
        company.region_id != null ? regionsById.get(String(company.region_id))?.name || "—" : "—";
      regionEl.textContent = regionName;
    }
  } catch (err) {
    console.error(err);
    setText("company-name", tr("company.errorLoading", "Error cargando empresa"));

    // ✅ SEO: error => noindex (evita que Google indexe soft-404)
    updateEmpresaSEO({ company: null, seoPortName: "", idParam, slugParam });
  }
}