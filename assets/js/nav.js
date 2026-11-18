// Mobile menu (diagonal panel) and the sticky mobile CTA.
export function initNav() {
  const toggle = document.querySelector("[data-menu-toggle]");
  const menu = document.querySelector("[data-menu]");
  const label = toggle?.querySelector(".menu-toggle__label");
  const outside = [document.querySelector("main"), document.querySelector(".site-foot"), document.querySelector("[data-sticky-cta]"), document.querySelector(".brand")].filter(Boolean);
  const wide = matchMedia("(min-width: 1024px)");

  if (toggle && menu) {
    toggle.hidden = false;
    const set = open => {
      toggle.setAttribute("aria-expanded", String(open));
      label.textContent = open ? label.dataset.labelClose : label.dataset.labelOpen;
      open ? menu.setAttribute("data-open", "") : menu.removeAttribute("data-open");
      outside.forEach(el => (el.inert = open));
      if (open) menu.querySelector("a")?.focus();
    };
    toggle.addEventListener("click", () => set(toggle.getAttribute("aria-expanded") !== "true"));
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") { set(false); toggle.focus(); }
    });
    menu.addEventListener("click", e => { if (e.target.closest("a")) set(false); });
    wide.addEventListener("change", () => set(false));
  }

  // sticky CTA: on the Start page only after the hero button has scrolled away; never over the footer or the ending
  const bar = document.querySelector("[data-sticky-cta]");
  if (!bar) return;
  const heroCta = document.querySelector("[data-hero-cta]");
  const blockers = [document.querySelector("[data-ending-cta]"), document.querySelector(".site-foot")].filter(Boolean);
  const state = { hero: !!heroCta, block: new Set() };
  const apply = () => (state.hero || state.block.size ? bar.setAttribute("data-hidden", "") : bar.removeAttribute("data-hidden"));
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.target === heroCta) state.hero = e.isIntersecting;
      else e.isIntersecting ? state.block.add(e.target) : state.block.delete(e.target);
    }
    apply();
  });
  heroCta && io.observe(heroCta);
  blockers.forEach(b => io.observe(b));
  apply();
}
