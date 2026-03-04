// ui/pagination.js

export function renderPagination({
  container,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
}) {
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  container.innerHTML = "";

  // If only one page, hide pagination
  if (totalPages <= 1) return;

  const mkLi = (label, page, disabled = false, active = false) => {
    const li = document.createElement("li");
    li.className = "pagination__item";

    const a = document.createElement("a");
    a.className =
      "pagination__link" +
      (active ? " is-active" : "") +
      (disabled ? " is-disabled" : "");
    a.href = "#";
    a.textContent = label;

    if (disabled) {
      a.setAttribute("aria-disabled", "true");
      a.tabIndex = -1;
    } else {
      if (active) a.setAttribute("aria-current", "page");
      a.addEventListener("click", (e) => {
        e.preventDefault();
        if (page === currentPage) return;

        if (typeof onPageChange === "function") {
          onPageChange(page);
        }

        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }

    li.appendChild(a);
    return li;
  };

  const mkEllipsis = () => {
    const li = document.createElement("li");
    li.className = "pagination__item pagination__ellipsis";
    const span = document.createElement("span");
    span.className = "pagination__link is-disabled";
    span.textContent = "…";
    li.appendChild(span);
    return li;
  };

  const frag = document.createDocumentFragment();

  // « -> primera página
  frag.appendChild(mkLi("«", 1, currentPage === 1, false));

  const windowSize = 5;
  const half = Math.floor(windowSize / 2);

  let start = Math.max(1, currentPage - half);
  let end = Math.min(totalPages, currentPage + half);

  // Expand to keep windowSize when near edges
  const visible = end - start + 1;
  if (visible < windowSize) {
    const missing = windowSize - visible;
    start = Math.max(1, start - missing);
    end = Math.min(
      totalPages,
      end + (windowSize - (end - start + 1))
    );
  }

  // First page + leading ellipsis
  if (start > 1) {
    frag.appendChild(mkLi("1", 1, false, currentPage === 1));
    if (start > 2) frag.appendChild(mkEllipsis());
  }

  // Middle window
  for (let p = start; p <= end; p++) {
    frag.appendChild(mkLi(String(p), p, false, p === currentPage));
  }

  // Last page + trailing ellipsis
  if (end < totalPages) {
    if (end < totalPages - 1) frag.appendChild(mkEllipsis());
    frag.appendChild(
      mkLi(String(totalPages), totalPages, false, currentPage === totalPages)
    );
  }

  // » -> última página
  frag.appendChild(mkLi("»", totalPages, currentPage === totalPages, false));

  container.appendChild(frag);
}
