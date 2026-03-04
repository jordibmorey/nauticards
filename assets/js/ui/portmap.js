import { SITE_ROOT } from "../config.js";
import { getPorts, getCompanies, getAreas } from "../dal.js";

const ZOOM_SWITCH = 9; // <= zonas | > puertos

function countCompaniesByPort(companies){
  const counts = new Map();
  for (const c of (companies || [])) {
    const ids = [];
    if (c.port_id != null) ids.push(String(c.port_id));
    if (Array.isArray(c.secondary_port_ids)) ids.push(...c.secondary_port_ids.map(String));
    for (const pid of ids) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
  return counts;
}

function anchorSVG() {
  return `
    <svg viewBox="1650 150 1400 2000" aria-hidden="true" focusable="false">
      <!-- aro superior (ancla derecha) -->
      <path fill="currentColor" d="M2181.6,1817.1 L2181.8,1823.3 L2182.2,1829.4 L2183,1835.4 L2184.1,1841.4 L2185.4,1847.2 L2187,1852.9 L2188.9,1858.5 L2191.1,1863.9 L2193.5,1869.3 L2196.1,1874.4 L2199,1879.5 L2202.2,1884.4 L2205.5,1889.1 L2209.1,1893.6 L2212.9,1898 L2216.8,1902.2 L2221,1906.1 L2225.4,1909.9 L2229.9,1913.5 L2234.6,1916.8 L2239.5,1920 L2244.6,1922.9 L2249.7,1925.5 L2255.1,1927.9 L2260.5,1930.1 L2266.1,1932 L2271.8,1933.6 L2277.6,1934.9 L2283.6,1936 L2289.6,1936.8 L2295.7,1937.2 L2301.9,1937.4 C2368.3,1937.4,2422.1,1883.5,2422.1,1817.1 C2422.1,1776.7,2402.2,1741,2371.7,1719.2 V1737.9 C2371.7,1776.4,2340.4,1807.7,2301.9,1807.7 H2301.9 C2263.3,1807.7,2232.1,1776.4,2232.1,1737.9 V1719.2 C2201.5,1741,2181.6,1776.7,2181.6,1817.1 Z"/>
      <!-- cuerpo del ancla (ancla derecha) -->
      <path fill="currentColor" d="M2887.2,950.55 L2882.8,937.14 L2877.9,923.92 L2872.5,910.91 L2866.6,898.14 L2860.2,885.6 L2853.5,873.32 L2846.4,861.32 L2839,849.6 L2831.4,838.19 L2823.6,827.09 L2815.7,816.33 L2807.6,805.91 L2799.5,795.85 L2791.3,786.18 L2783.2,776.89 L2775.2,768.01 L2767.3,759.56 L2759.6,751.54 L2752,743.97 L2744.8,736.87 L2737.9,730.25 L2731.3,724.13 L2725.1,718.52 L2719.4,713.44 L2714.2,708.9 L2709.5,704.92 L2705.4,701.51 L2702,698.68 L2699.2,696.46 L2698.1,695.58 L2697.2,694.85 L2696.5,694.29 L2696,693.88 L2695.6,693.63 L2695.5,693.55 C2738.2,693.55,2771.9,687.99,2798.6,679.22 C2784.8,661.9,2757.2,629.44,2720.6,596.99 C2666.9,549.44,2593.8,501.91,2515.8,501.91 C2436.2,501.91,2371.7,566.42,2371.7,646 V1409.1 H2568.9 C2589.9,1409.1,2606.9,1426.1,2606.9,1447.1 V1507.8 C2606.9,1528.8,2589.9,1545.8,2568.9,1545.8 H2371.7 V1621.2 C2452.2,1649.8,2509.9,1726.8,2509.9,1817.1 C2509.9,1932,2416.7,2025.1,2301.9,2025.1 C2187,2025.1,2093.9,1932,2093.9,1817.1 C2093.9,1726.8,2151.5,1649.8,2232.1,1621.2 V1545.8 H2034.8 C2013.8,1545.8,1996.8,1528.8,1996.8,1507.8 V1447.1 C1996.8,1426.1,2013.8,1409.1,2034.8,1409.1 H2232.1 V646 C2232.1,606.21,2215.9,570.19,2189.9,544.11 C2163.8,518.04,2127.8,501.91,2088,501.91 C1956.7,501.91,1839.2,636.51,1805.2,679.22 C1831.8,687.99,1865.5,693.55,1908.2,693.55 C1908.2,693.55,1759.7,806.45,1716.6,950.55 C1716.6,950.55,1594.8,779.71,1704.7,567.27 C1704.7,567.27,1704.7,602.34,1734.5,635.53 C1755,586.75,1810.6,487.59,1944.8,410.79 C2120.2,310.48,2238.7,268.73,2293.2,179.71 C2297.2,173.28,2306.6,173.28,2310.5,179.71 C2365.1,268.73,2483.6,310.48,2658.9,410.79 C2793.1,487.59,2848.8,586.75,2869.2,635.53 C2899.1,602.34,2899.1,567.27,2899.1,567.27 C3009,779.71,2887.2,950.55,2887.2,950.55 Z"/>
    </svg>
  `;
}

function makePortIcon(count){
  const n = Number(count) || 0;
  return L.divIcon({
    className: "",
    html: `
      <div class="nc-anchor">
        ${anchorSVG()}
        <div class="nc-badge">${n}</div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    tooltipAnchor: [0, -18],
    popupAnchor: [0, -16],
  });
}

function makeZoneIcon(total){
  const n = Number(total) || 0;
  return L.divIcon({
    className: "",
    html: `<div class="nc-zone">${n}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    tooltipAnchor: [0, -18],
    popupAnchor: [0, -16],
  });
}

// cluster = SUMA empresas (no nº puertos)
function makeClusterIcon(cluster){
  const markers = cluster.getAllChildMarkers();
  let sum = 0;
  for (const m of markers) sum += Number(m.options.companyCount || 0);
  return L.divIcon({
    className: "",
    html: `<div class="nc-cluster">${sum}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

export async function initPortsMap(){
  const el = document.getElementById("portsMap");
  if (!el) return;

  // Asegura Leaflet cargado
  if (typeof window.L === "undefined") {
    console.error("Leaflet (L) no está cargado. Revisa los <script defer> en index.html");
    return;
  }

  const map = L.map(el, { zoomControl: true, scrollWheelZoom: true });

  

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  const [ports, companiesLite, areas] = await Promise.all([
    getPorts(),
    getCompanies(),   // lite
    getAreas(),       // zonas -> nombre
  ]);

  const counts = countCompaniesByPort(companiesLite);

  const areaNameById = new Map((areas || []).map(a => [String(a.id), String(a.name || a.id)]));

  const buscarBase = new URL("pages/buscar/index.html", SITE_ROOT).href;

  const portsCluster = L.markerClusterGroup({
    iconCreateFunction: makeClusterIcon,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    disableClusteringAtZoom: 12,
  });

  const zoneLayer = L.layerGroup();
  const zoneAgg = new Map(); // areaId -> {sum, latSum, lonSum, nPorts, label}

  const boundsPts = [];

  for (const p of (ports || [])) {
    const lat = Number(p.lat);
    const lon = Number(p.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const portId = String(p.id);
    const portName = String(p.name || portId);

    const n =
      Number.isFinite(Number(p.company_count)) ? Number(p.company_count)
      : Number.isFinite(Number(p.companies_count)) ? Number(p.companies_count)
      : (counts.get(portId) || 0);

    const href = `${buscarBase}?puerto=${encodeURIComponent(portId)}`;

    const m = L.marker([lat, lon], {
      icon: makePortIcon(n),
      companyCount: n,
    });

    m.bindTooltip(portName, { direction:"top", opacity: 1, sticky: true });
    m.on("click", () => { window.location.href = href; });

    portsCluster.addLayer(m);

    const areaId = p.area_id != null ? String(p.area_id) : "SIN_ZONA";
    const areaLabel = areaNameById.get(areaId) || areaId;

    const cur = zoneAgg.get(areaId) || { sum: 0, latSum: 0, lonSum: 0, nPorts: 0, label: areaLabel };
    cur.sum += n;
    cur.latSum += lat;
    cur.lonSum += lon;
    cur.nPorts += 1;
    zoneAgg.set(areaId, cur);

    boundsPts.push([lat, lon]);
  }

  for (const [areaId, a] of zoneAgg.entries()) {
    const lat = a.latSum / a.nPorts;
    const lon = a.lonSum / a.nPorts;
    const label = a.label || areaNameById.get(areaId) || areaId;

    const zm = L.marker([lat, lon], { icon: makeZoneIcon(a.sum) }).addTo(zoneLayer);
    zm.bindTooltip(label, { direction:"top", opacity: 1, sticky: true });
    zm.on("click", () => map.setView([lat, lon], ZOOM_SWITCH + 1, { animate: true }));
  }

  if (boundsPts.length) map.fitBounds(L.latLngBounds(boundsPts).pad(0.15), { animate: false });
  else map.setView([41.3851, 2.1734], 8);

  function refreshLayers(){
    const z = map.getZoom();
    const showZones = z <= ZOOM_SWITCH;

    if (showZones) {
      if (map.hasLayer(portsCluster)) map.removeLayer(portsCluster);
      if (!map.hasLayer(zoneLayer)) map.addLayer(zoneLayer);
    } else {
      if (map.hasLayer(zoneLayer)) map.removeLayer(zoneLayer);
      if (!map.hasLayer(portsCluster)) map.addLayer(portsCluster);
    }
  }

  map.on("zoomend", refreshLayers);
  refreshLayers();
}