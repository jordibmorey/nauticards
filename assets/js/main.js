import { runRouter } from "./router.js";
import { initMobileMenu, initServicesNavDropdown } from "./ui/nav.js";
import { bindHomeCtaForm, bindContactForm } from "./ui/forms.js";

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  bindHomeCtaForm();
  bindContactForm();

  const start = async () => {
    await initServicesNavDropdown();
    await runRouter();
  };

  if (window.__t) start().catch(console.error);
  else window.addEventListener("i18n:ready", () => start().catch(console.error), { once: true });
});
