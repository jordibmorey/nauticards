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
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;

  const url = `${base}/rest/v1/${pathAndQuery}`;

  const r = await fetch(url, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  if (!r.ok) {
    const body = await r.text();
    console.error("Supabase error:", body);
    return [];
  }

  return r.json();
}

export async function onRequestGet({ env }) {
  const BASE = "https://nauticards.es/";
  const now = new Date().toISOString();

  const urls = [];

  // ===== PÁGINAS ESTÁTICAS =====

  urls.push(new URL("", BASE).href);
  urls.push(new URL("pages/buscar/", BASE).href);

  // ===== CARGAR DATOS =====

  const [companies, services, ports] = await Promise.all([
    sbGet(env, "companies?select=id"),
    sbGet(env, "services?select=id"),
    sbGet(env, "ports?select=id"),
  ]);

  // ===== EMPRESAS =====

  if (Array.isArray(companies)) {
    for (const c of companies) {
      urls.push(
        new URL(
          `pages/empresa/?id=${encodeURIComponent(c.id)}`,
          BASE
        ).href
      );
    }
  }

  // ===== PUERTOS =====

  if (Array.isArray(ports)) {
    for (const p of ports) {
      urls.push(
        new URL(
          `pages/buscar/?puerto=${encodeURIComponent(p.id)}`,
          BASE
        ).href
      );
    }
  }

  // ===== SERVICIOS =====

  if (Array.isArray(services)) {
    for (const s of services) {
      urls.push(
        new URL(
          `pages/buscar/?servicio=${encodeURIComponent(s.id)}`,
          BASE
        ).href
      );
    }
  }

  // ===== SERVICIO + PUERTO =====

  if (Array.isArray(services) && Array.isArray(ports)) {
    for (const s of services) {
      for (const p of ports) {
        urls.push(
          new URL(
            `pages/buscar/?servicio=${encodeURIComponent(
              s.id
            )}&puerto=${encodeURIComponent(p.id)}`,
            BASE
          ).href
        );
      }
    }
  }

  // ===== GENERAR XML =====

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `<url>
  <loc>${xmlEscape(u)}</loc>
  <lastmod>${now}</lastmod>
</url>`
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
    },
  });
}
