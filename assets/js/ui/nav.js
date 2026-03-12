import { SITE_ROOT } from "../config.js";
import { getServices } from "../dal.js";
import { debounce, normalize, safeText, safeAttr, sortByName, tr } from "../utils.js";


export function initMobileMenu(){
  const toggle = document.querySelector(".menu-toggle");
  const menu = document.getElementById("mobileMenu");
  if (!toggle || !menu) return;

  const closeEls = menu.querySelectorAll("[data-close-menu]");

  const setOpen = (open) => {
    document.body.classList.toggle("menu-open", open);
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  };

  toggle.addEventListener("click", () => {
    setOpen(menu.hidden); // si está hidden => abrir
  });

  closeEls.forEach(el => el.addEventListener("click", () => setOpen(false)));

  // Cierra al clicar cualquier link del menú
  menu.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (a) setOpen(false);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setOpen(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 770) setOpen(false);
  });
}

export function initHeaderServicesDropdown(servicesList) {
  const ul = document.getElementById("servicesMenuList");
  if (!ul) return;

  const buscarBase = new URL("buscar/", SITE_ROOT).href;

  const sorted = (servicesList || [])
    .slice()
    .sort(sortByName);

  if (!sorted.length) {
    ul.innerHTML = `<li style="padding:.55rem 1rem; color:#111;">${safeText(tr("services.none", "No hay servicios"))}</li>`;
    return;
  }

  ul.innerHTML = sorted
    .map((s) => {
      const id = String(s.id);
      const name = s.name || id;
      const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;

      return `
        <li>
          <a href="${safeAttr(href)}"
             style="display:block; padding:.55rem 1rem; text-decoration:none; color:#111;"
             onmouseover="this.style.background='#f2f4f7';"
             onmouseout="this.style.background='transparent';">
            ${safeText(name)}
          </a>
        </li>
      `;
    })
    .join("");
}

function bindNavDropdownBehavior(root) {
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const btn = root.querySelector(".nav-dropdown__trigger");
  const panel = root.querySelector(".nav-dropdown__panel");
  if (!btn || !panel) return;

  const close = () => {
    root.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
  };

  const open = () => {
    root.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
  };

  // ===== DESKTOP HOVER (wrapper completo) =====
  root.addEventListener("mouseenter", open);
  root.addEventListener("mouseleave", close);

  // ===== CLICK / MOBILE =====
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    root.classList.contains("is-open") ? close() : open();
  });

  btn.addEventListener(
    "touchstart",
    (e) => {
      if (!root.classList.contains("is-open")) {
        e.preventDefault();
        open();
      }
    },
    { passive: false }
  );

  // ===== CLICK FUERA =====
  document.addEventListener("click", (e) => {
    if (!root.classList.contains("is-open")) return;
    if (root.contains(e.target)) return;
    close();
  });

  // ===== ESC =====
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
}

function renderServicesDropdownPanel(panel, servicesList) {
  if (!panel) return;

  const buscarBase = new URL("buscar/", SITE_ROOT).href;

  // ===== Agrupar servicios por letra =====
  const groups = new Map();
  for (const s of servicesList || []) {
    const name = (s?.name || "").trim();
    const letter = (name[0] || "#").toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(s);
  }

  const letters = Array.from(groups.keys()).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b, "es");
  });

  const lettersHtml = letters
    .map((l) => `<button type="button" class="svcLetter" data-letter="${safeAttr(l)}">${safeText(l)}</button>`)
    .join("");

  const listsHtml = letters
    .map((l) => {
      const items = (groups.get(l) || [])
        .slice()
        .sort(sortByName)
        .map((s) => {
          const id = String(s.id);
          const name = s.name || id;
          const href = `${buscarBase}?servicio=${encodeURIComponent(id)}`;
          return `<a class="svcItem" href="${safeAttr(href)}">${safeText(name)}</a>`;
        })
        .join("");
      return `<div class="svcGroup" data-letter="${safeAttr(l)}">${items}</div>`;
    })
    .join("");

  // ===== HTML =====
  panel.innerHTML = `
    <div class="svcPanel">
      <div class="svcPanel__header">
        <input class="input input--sm svcSearch" type="search" placeholder="${tr("nav.services.searchPlaceholder", "Buscar servicio…")}" autocomplete="off" />
      </div>

      <div class="svcLetters">${lettersHtml}</div>

      <div class="svcSearchResults" style="display:none; padding:12px;"></div>

      <div class="svcLists">${listsHtml}</div>
    </div>
  `;

  const btns = Array.from(panel.querySelectorAll(".svcLetter"));
  const groupsEls = Array.from(panel.querySelectorAll(".svcGroup"));
  const searchEl = panel.querySelector(".svcSearch");
  const searchResultsEl = panel.querySelector(".svcSearchResults");
  const lettersBarEl = panel.querySelector(".svcLetters");
  const listsWrapEl = panel.querySelector(".svcLists");

  // ===== Mostrar letra =====
  const showLetter = (letter) => {
    if (searchEl && searchEl.value) {
      searchEl.value = "";
      Array.from(panel.querySelectorAll(".svcItem")).forEach((a) => (a.style.display = ""));
    }

    groupsEls.forEach((g) => (g.style.display = g.dataset.letter === letter ? "" : "none"));
    btns.forEach((b) => b.classList.toggle("is-active", b.dataset.letter === letter));
  };

  if (letters.length) showLetter(letters[0]);
  btns.forEach((b) => b.addEventListener("click", () => showLetter(b.dataset.letter)));

  // ===== Búsqueda =====
  if (searchEl) {
    const onSearch = debounce(() => {
      const q = normalize(searchEl.value);

      // ---- RESET ----
      if (!q) {
        if (lettersBarEl) lettersBarEl.style.display = "";
        if (listsWrapEl) listsWrapEl.style.display = "";
        if (searchResultsEl) searchResultsEl.style.display = "none";

        Array.from(panel.querySelectorAll(".svcItem")).forEach((a) => (a.style.display = ""));

        const active = btns.find((b) => b.classList.contains("is-active")) || btns[0];
        if (active) showLetter(active.dataset.letter);
        return;
      }

      // ---- MODO BÚSQUEDA (2 columnas) ----
      const matches = [];
      groupsEls.forEach((g) => {
        Array.from(g.querySelectorAll(".svcItem")).forEach((a) => {
          if (normalize(a.textContent).includes(q)) matches.push(a);
        });
      });

      if (lettersBarEl) lettersBarEl.style.display = "none";
      if (listsWrapEl) listsWrapEl.style.display = "none";
      if (searchResultsEl) searchResultsEl.style.display = "";

      btns.forEach((b) => b.classList.remove("is-active"));

      if (!searchResultsEl) return;

      if (!matches.length) {
        searchResultsEl.innerHTML = `<div style="padding:8px 0;color:#666;">No hay resultados.</div>`;
        return;
      }

      const seen = new Set();
      const itemsHtml = matches
        .map((a) => {
          const href = a.getAttribute("href") || "";
          if (seen.has(href)) return "";
          seen.add(href);

          return `
            <a href="${safeAttr(href)}"
               style="display:block;padding:10px 12px;border-radius:12px;text-decoration:none;color:#111;"
               onmouseover="this.style.background='#f2f4f7';"
               onmouseout="this.style.background='transparent';">
              ${safeText(a.textContent || "")}
            </a>`;
        })
        .join("");

      searchResultsEl.innerHTML = `
        <div style="font-weight:700;margin-bottom:8px;">
          ${matches.length} resultado${matches.length === 1 ? "" : "s"}
        </div>

        <div style="
          display:grid;
          grid-template-columns: repeat(auto-fit, minmax(220px,1fr));
          gap:6px 12px;
        ">
          ${itemsHtml}
        </div>
      `;
    }, 150);

    searchEl.addEventListener("input", onSearch);
  }
}

export async function initServicesNavDropdown() {
  const dropdownPanels = Array.from(document.querySelectorAll("[data-services-dropdown]"));
  if (!dropdownPanels.length) return;

  dropdownPanels.forEach((panel) => bindNavDropdownBehavior(panel.closest(".nav-dropdown")));

  try {
    const servicesList = await getServices();
    dropdownPanels.forEach((panel) => renderServicesDropdownPanel(panel, servicesList || []));
  } catch (err) {
    console.error(err);
  }
}