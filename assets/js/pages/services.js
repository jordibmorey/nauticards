import { SITE_ROOT } from "../config.js";
import { getServices, getCompanies } from "../dal.js";
import { normalize, debounce, sortByName, safeText, safeAttr, tr } from "../utils.js";




export async function initServicesPage() {
  const allListEl = document.getElementById("servicesGrid");
  if (!allListEl) return;

  const popularListEl = document.getElementById("servicesPopular"); // puede existir o no
  const searchEl = document.getElementById("servicesSearch"); // puede existir o no

  try {
    const [servicesList, companies] = await Promise.all([getServices(), getCompanies()]);

    // (Opcional) conteo de empresas por servicio, por si lo usas luego
    const counts = new Map();
    for (const c of companies || []) {
      const ids = Array.isArray(c.service_ids) ? c.service_ids.map(String) : [];
      for (const sid of ids) counts.set(sid, (counts.get(sid) || 0) + 1);
    }

    const buscarBase = new URL("pages/buscar/index.html", SITE_ROOT).href;
    const PLACEHOLDER = new URL("assets/img/placeholder.jpg", SITE_ROOT).href;

    // Card para "Populares" (si existe esa sección)
    const renderServiceCard = (s) => {
      const id = String(s.id);
      const name = s.name || id;
      const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;
      const imgUrl = s.image_url ? String(s.image_url) : PLACEHOLDER;

      return `
        <li class="card card--category">
          <a class="category-card__link" href="${safeAttr(href)}" aria-label="${safeAttr(name)}">
            <img
              class="category-card__img"
              src="${safeAttr(imgUrl)}"
              alt=""
              loading="lazy"
              onerror="this.onerror=null; this.src='${safeAttr(PLACEHOLDER)}';"
            />
            <h3 class="company-card__title category-card__title">${safeText(name)}</h3>
          </a>
        </li>
      `;
    };

    // Listado A-Z en GRID de 5 columnas (cada letra es un bloque/columna)
    const renderAllAlphabeticalColumns = (list) => {
      if (!list || !list.length) {
        allListEl.innerHTML =
          `<li class="card"><div class="card__inner"><p class="body-text">No hay servicios.</p></div></li>`;
        return;
      }

      // Agrupar por letra
      const groups = new Map();
      for (const s of list) {
        const name = (s.name || "").trim();
        const letter = (name[0] || "#").toUpperCase();
        if (!groups.has(letter)) groups.set(letter, []);
        groups.get(letter).push(s);
      }

      // Ordenar letras (# al final)
      const letters = Array.from(groups.keys()).sort((a, b) => {
        if (a === "#") return 1;
        if (b === "#") return -1;
        const locale = window.__lang === "en" ? "en" : "es";
        return a.localeCompare(b, locale, { sensitivity: "base" });
      });

      allListEl.innerHTML = letters
        .map((letter) => {
          const items = (groups.get(letter) || [])
            .slice()
            .sort(sortByName)
            .map((s) => {
              const id = String(s.id);
              const name = s.name || id;
              const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;

              return `
                <li class="service-item">
                  <a class="service-item__link" href="${safeAttr(href)}">${safeText(name)}</a>
                </li>
              `;
            })
            .join("");

          return `
            <li class="services-letter">
              <h3 class="services-letter__title">${safeText(letter)}</h3>
              <ul class="services-letter__list" aria-label="Servicios ${safeAttr(letter)}">
                ${items}
              </ul>
            </li>
          `;
        })
        .join("");
    };

    // Sort alfabético base
    const allSorted = (servicesList || [])
      .slice()
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

    // Asegura la clase correcta del contenedor (por si el HTML no la trae aún)
    allListEl.classList.add("services-columns");

    // === POPULARES (si existe bloque) ===
    if (popularListEl) {
      const featured = allSorted.filter((s) => Boolean(s.featured)).slice(0, 10);
      const section = popularListEl.closest("section");

      if (!featured.length) {
        if (section) section.style.display = "none";
      } else {
        if (section) section.style.display = "";
        popularListEl.innerHTML = featured.map(renderServiceCard).join("");
      }
    }

    // === TODOS (grid por letras en 5 columnas) ===
    renderAllAlphabeticalColumns(allSorted);

    // === SEARCH (filtra SOLO "Todos") ===
    if (searchEl && searchEl.dataset.bound !== "1") {
      searchEl.dataset.bound = "1";

      const doFilter = debounce(() => {
        const q = normalize(searchEl.value);
        if (!q) {
          renderAllAlphabeticalColumns(allSorted);
          return;
        }
        const filtered = allSorted.filter((s) => normalize(s.name).includes(q));
        renderAllAlphabeticalColumns(filtered);
      }, 120);

      searchEl.addEventListener("input", doFilter);
    }
  } catch (e) {
    console.error(e);
    allListEl.innerHTML =
      `<li class="card"><div class="card__inner"><p class="body-text">No se pudieron cargar los servicios.</p></div></li>`;
    if (popularListEl) popularListEl.innerHTML = "";
  }
}