// assets/js/i18n.js

export function getLang() {
  const urlLang = new URLSearchParams(location.search).get("lang");
  const saved = localStorage.getItem("lang");
  const lang = (urlLang || saved || "es").toLowerCase();
  return lang === "en" ? "en" : "es";
}

export async function loadDict(lang) {
  const res = await fetch(`/data/${lang}.json`, { cache: "no-store" });
  if (!res.ok) throw new Error(`No puedo cargar /data/${lang}.json`);
  return await res.json();
}

export function applyI18n(t) {
  // textContent
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (t[key] != null) el.textContent = t[key];
  });

  // placeholder
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (t[key] != null) el.setAttribute("placeholder", t[key]);
  });

  // aria-label
  document.querySelectorAll("[data-i18n-aria]").forEach((el) => {
    const key = el.getAttribute("data-i18n-aria");
    if (t[key] != null) el.setAttribute("aria-label", t[key]);
  });

  // title attribute
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    if (t[key] != null) el.setAttribute("title", t[key]);
  });
}

export function applyMeta(t, pageKeyPrefix) {
  // title
  const titleKey = `meta.${pageKeyPrefix}.title`;
  if (t[titleKey]) document.title = t[titleKey];

  // meta description
  const descKey = `meta.${pageKeyPrefix}.description`;
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && t[descKey]) metaDesc.setAttribute("content", t[descKey]);
}

// -----------------------------
// Language dropdown (ES / EN)
// -----------------------------
export function initLangDropdown(currentLang) {
  const dropdown = document.getElementById("langDropdown");
  if (!dropdown) return;

  const trigger = dropdown.querySelector(".lang-dropdown__trigger");
  const menu = dropdown.querySelector(".lang-dropdown__menu");
  const current = document.getElementById("langCurrent");

  const otherLang = currentLang === "es" ? "en" : "es";

  // Texto principal (ES ▾ / EN ▾)
  if (current) current.textContent = currentLang.toUpperCase();

  // Renderiza SOLO el idioma contrario
  if (menu) {
    menu.innerHTML = `
      <button type="button" role="menuitem" data-lang="${otherLang}">
        ${otherLang.toUpperCase()}
      </button>
    `;
  }

  // Toggle menú en móvil (añade/quita clase .open)
  if (trigger) {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      dropdown.classList.toggle("open");
      trigger.setAttribute(
        "aria-expanded",
        dropdown.classList.contains("open") ? "true" : "false"
      );
    });
  }

  // Cerrar al clicar fuera (solo si clicas fuera del dropdown)
  document.addEventListener("click", (e) => {
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove("open");
      trigger?.setAttribute("aria-expanded", "false");
    }
  });

  // Cambiar idioma (delegación: funciona aunque uses innerHTML)
  menu?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const newLang = btn.dataset.lang;
    localStorage.setItem("lang", newLang);

    const url = new URL(location.href);
    url.searchParams.set("lang", newLang);
    location.href = url.toString();
  });
}


