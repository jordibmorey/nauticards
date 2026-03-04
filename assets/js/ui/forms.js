import { API_BASE } from "../config.js";



export function bindHomeCtaForm() {
  const form = document.querySelector(".cta-form__form");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      source: "home_cta",
      lang: window.__lang || "es",
      nombre: safe(fd.get("nombre")),
      email: safe(fd.get("email")),
      mensaje: safe(fd.get("mensaje")),
      page: location.href,
    };

    if (!payload.nombre || !payload.email || !payload.mensaje) return;
    if (!isEmail(payload.email)) return;

    const btn = form.querySelector("button[type='submit']");
    const oldText = btn?.textContent || "Enviar";

    try {
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = "Enviando…";

      await postJSON("/api/forms/home", payload);

      form.reset();
      if (btn) btn.textContent = "Enviado ✓";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 1500);
    } catch (err) {
      console.error("HOME CTA form error:", err);
      if (btn) btn.textContent = "Error. Intenta de nuevo";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 2000);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

export function bindContactForm() {
  const form = document.getElementById("contactForm");
  if (!form || form.dataset.bound === "1") return;
  form.dataset.bound = "1";

  const statusEl = document.getElementById("contactStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const fd = new FormData(form);
    const payload = {
      source: "contact_page",
      lang: window.__lang || "es",
      nombre: safe(fd.get("nombre")),
      email: safe(fd.get("email")),
      motivo: safe(fd.get("motivo")),
      mensaje: safe(fd.get("mensaje")),
      page: location.href,
    };

    if (!payload.nombre || !payload.email || !payload.motivo || !payload.mensaje) return;
    if (!isEmail(payload.email)) return;

    const btn = form.querySelector("button[type='submit']");
    const oldText = btn?.textContent || "Enviar";

    try {
      if (statusEl) statusEl.textContent = "Enviando…";
      if (btn) btn.disabled = true;
      if (btn) btn.textContent = "Enviando…";

      await postJSON("/api/forms/contact", payload);

      form.reset();
      if (statusEl) statusEl.textContent = "Enviado ✓ Te responderemos pronto.";
      if (btn) btn.textContent = "Enviado ✓";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 1500);
    } catch (err) {
      console.error("CONTACT form error:", err);
      if (statusEl) statusEl.textContent = "Error enviando. Prueba más tarde.";
      if (btn) btn.textContent = "Error";
      setTimeout(() => {
        if (btn) btn.textContent = oldText;
      }, 2000);
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

function safe(v) {
  return (v ?? "").toString().trim();
}

async function postJSON(path, payload) {
  const url = new URL(path, API_BASE).href; // SITE_ROOT ya lo tienes definido en tu app.js
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => ({}));
}