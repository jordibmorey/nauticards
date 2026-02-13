// functions/sitemap.xml.js

function xmlEscape(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function sbGet(env, pathAndQuery) {
  const base = env.SUPABASE_URL;
  const key =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SUPABASE_ANON_KEY;

  if (!base || !key) {
    return { error: "Missing SUPABASE_URL or key env vars" };
  }

  const u = `${base}/rest/v1/${pathAndQuery}`;
  const r = await fetch(u, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    return { error: `Supabase error ${r.status}`, detail: body };
  }
  return r.json();
}

export async function onRequestGet({ env }) {
  const BASE = "https://nauticards.es/"; // canonical
  const now = new Date().toISOString();

  // URLs estáticas (según tu estructura actual)
  const staticUrls = [
    new URL("", BASE).href,
    new URL("pages/buscar/", BASE).href,
    new URL("pages/puertos/", BASE).href,
    new URL("pages/servicios/", BASE).href,
    new URL("pages/regiones/", BASE).href,
    new URL("pages/contacto/", BASE).href,
    new URL("pages/legal/aviso-legal.html", BASE).href,
    new URL("pages/legal/privacidad.html", BASE).href,
    new URL("pages/legal/cookies.html", BASE).href,
  ];

  // Empresas: sacamos IDs (y si existe updated_at, mejor)
  // Ajusta campos si tu tabla no tiene updated_at:
  const companies = await sbGet(env, "companies?select=id,updated_at");

  if (companies?.error) {
    return new Response(
      `Sitemap error: ${companies.error}\n${companies.detail || ""}`,
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const companyUrls = (companies || [])
    .map((c) => {
      const id = c?.id != null ? String(c.id) : "";
      if (!id) return null;

      // Tu ficha actual es /pages/empresa/index.html?id=...
      const loc = new URL(
        `pages/empresa/index.html?id=${encodeURIComponent(id)}`,
        BASE
      ).href;

      // lastmod si existe updated_at
      const lastmod = c?.updated_at ? new Date(c.updated_at).toISOString() : now;
      return { loc, lastmod };
    })
    .filter(Boolean);

  const entries = [
    ...staticUrls.map((loc) => ({ loc, lastmod: now })),
    ...companyUrls,
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    entries
      .map(
        (u) =>
          `<url>` +
          `<loc>${xmlEscape(u.loc)}</loc>` +
          `<lastmod>${xmlEscape(u.lastmod)}</lastmod>` +
          `</url>`
      )
      .join("") +
    `</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
