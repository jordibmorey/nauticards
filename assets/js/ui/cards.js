import { SITE_ROOT } from "../config.js";
import { safeText, safeAttr, sanitizeUrl, tr } from "../utils.js";



function companyDetailHref(company) {
  // Keep coherence with your real HTML: /pages/empresa/index.html
  const base = new URL("pages/empresa/index.html", SITE_ROOT).href;
  if (company?.id != null) return `${base}?id=${encodeURIComponent(String(company.id))}`;
  return `${base}?slug=${encodeURIComponent(String(company?.slug || ""))}`;
}

function renderCompanyCard(company, lookups, selectedServiceId = "") {
  const href = companyDetailHref(company);

  const isFeatured = Boolean(company?.featured ?? company?.destacada);

  // Services:
  // - Render ALL services (for completeness/SEO/future DB)
  // - Keep the visual layout as a single row that fades/cuts to the right
  // - If a service filter is active and the company has it, force it to appear first.
  const selected = String(selectedServiceId || "");

  const companyServiceIds = Array.isArray(company.service_ids) ? company.service_ids.map(String) : [];
  const idsToShow = [];

  if (selected && companyServiceIds.includes(selected)) idsToShow.push(selected);
  for (const id of companyServiceIds) {
    if (!idsToShow.includes(id)) idsToShow.push(id);
  }

  const serviceNames = idsToShow
    .map((id) => lookups.services.get(String(id))?.name)
    .filter(Boolean);

  // Note: each tag is nowrap; the container is 1-line with fade cut.
  const servicesHTML = serviceNames
    .map((n) => `<span class="tag" style="white-space:nowrap;">${safeText(n)}</span>`)
    .join("");

  const logoUrl = sanitizeUrl(company.logo);
  const logoHTML = logoUrl
    ? `<img class="company-card__logo" src="${safeAttr(logoUrl)}" alt="Logo de ${safeAttr(company.name)}" loading="lazy" decoding="async">`
    : "";

  const portName = company.port_id ? (lookups.ports.get(String(company.port_id))?.name || "—") : "—";
  const regionName =
    company.region_id && lookups.regions
      ? (lookups.regions.get(String(company.region_id))?.name || "—")
      : "—";

  const secCount = Array.isArray(company.secondary_port_ids) ? company.secondary_port_ids.length : 0;
  const portLabel = secCount > 0 ? `${portName} (+${secCount})` : portName;

  const email = (company.email || "").toString().trim();
  const website = sanitizeUrl(company.website);

  const contactBtn = email
  ? `<a class="button button--ghost" href="mailto:${safeAttr(email)}">${safeText(tr("company.action.contact", "Contactar"))}</a>`
  : (website
      ? `<a class="button button--ghost" href="${safeAttr(website)}" target="_blank" rel="noopener">${safeText(tr("company.field.web", "Web"))}</a>`
      : "");

  return `
  <article
    class="company-card ${isFeatured ? "company-card--featured" : ""}"
    role="listitem"
    style="display:flex; flex-direction:column; height:100%;"
  >
    <header class="company-card__header">
      ${logoHTML}

      <div class="company-card__headerText">
        <h3 class="company-card__title">
          <a href="${safeAttr(href)}">${safeText(company.name)}</a>
        </h3>

        <div
          class="company-card__tags"
          style="
            margin-top: var(--space-2);
            display:flex;
            gap: var(--space-2);
            flex-wrap: nowrap;
            overflow: hidden;
            white-space: nowrap;
            position: relative;
            -webkit-mask-image: linear-gradient(to right, #000 0%, #000 78%, transparent 100%);
                    mask-image: linear-gradient(to right, #000 0%, #000 78%, transparent 100%);
          "
        >
          ${servicesHTML || '<span class="tag">—</span>'}
        </div>
      </div>
    </header>

    <div style="margin-top:auto; display:grid; gap: var(--space-3);">
      <dl class="company-card__meta">
        <div><dt>${safeText(tr("company.field.port", "Puerto"))}</dt><dd>${safeText(portLabel)}</dd></div>
        <div><dt>${safeText(tr("common.region", "Región"))}</dt><dd>${safeText(regionName)}</dd></div>
      </dl>

      <footer class="company-card__footer">
        <a class="button button--secondary" href="${safeAttr(href)}">${safeText(tr("common.viewProfile", "Ver ficha"))}</a>
        ${contactBtn}
      </footer>
    </div>
  </article>
`;
}

export { companyDetailHref, renderCompanyCard };
