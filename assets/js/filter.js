// Category filter: dims cards in the moving wall (Start), hides cards in the grid (Arbeiten).
export function initFilter() {
  document.querySelectorAll("[data-filter]").forEach(group => {
    const id = group.dataset.filter;
    const status = group.parentElement.querySelector("[data-filter-status]");
    const scope = id === "wall" ? group.closest("section").querySelector("[data-wall]") : document.querySelector(`[data-filter-target="${id}"]`);
    if (!scope) return;
    const items = [...scope.children];
    const chips = [...group.querySelectorAll("[data-chip]")];
    group.hidden = false;
    group.addEventListener("click", e => {
      const chip = e.target.closest("[data-chip]");
      if (!chip) return;
      const cat = chip.dataset.chip;
      chips.forEach(c => c.setAttribute("aria-pressed", String(c === chip)));
      let n = 0;
      items.forEach(it => {
        const on = cat === "all" || it.dataset.cat === cat;
        if (on) n++;
        if (id === "wall") { it.classList.toggle("is-dim", !on); it.inert = !on; }
        else it.hidden = !on;
      });
      if (status) status.textContent = n === 1 ? status.dataset.tplOne : status.dataset.tpl.replace("{n}", n);
    });
  });
}
