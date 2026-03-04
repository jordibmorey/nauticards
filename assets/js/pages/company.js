import { SITE_ROOT } from "../config.js";
import { getCompany, getServices, getPorts, getRegions, getAreas } from "../dal.js";
import { safeText, safeAttr, sanitizeUrl, indexById, tr } from "../utils.js";
import { updateEmpresaSEO } from "../seo.js";

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
        servicesEl.innerHTML = `<li class="service-row">—</li>`;
      } else {
        servicesEl.innerHTML = sIds
          .map((sid) => {
            const s = servicesById.get(String(sid));
            const label = s?.name || sid;
            return `<li class="service-row">${safeText(label)}</li>`;
          })
          .join("");
      }
    }

    // Gallery
    const galleryEl = document.getElementById("company-gallery");
    if (galleryEl) {
      const imgs = Array.isArray(company.images) ? company.images : [];

      if (imgs.length === 0) {
        galleryEl.innerHTML = `
          <a href="/pages/contacto/index.html" class="gallery-thumb gallery-thumb--placeholder">
            <span>+</span>
          </a>
        `;
      } else {
        galleryEl.innerHTML = imgs
          .map((src) => {
            const safeSrc = sanitizeUrl(src);
            if (!safeSrc) return "";
            return `
              <a class="gallery-thumb" href="${safeAttr(safeSrc)}" target="_blank" rel="noopener">
                <img src="${safeAttr(safeSrc)}" alt="${safeAttr(company.name || tr("company.imageAltFallback", "Imagen"))}"
                  loading="lazy" />
              </a>
            `;
          })
          .join("");
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
    if (logoImg) {
      const src = sanitizeUrl(company.logo);
      if (src) {
        logoImg.src = src;
        logoImg.alt = company.name || "Logo";
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