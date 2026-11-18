// Contact form: front-end only. Without JavaScript the form opens the visitor's mail program (mailto).
// With JavaScript: inline validation in German, error summary, success state announced via aria-live. Nothing is sent.
export function initForm() {
  const form = document.querySelector("[data-form]");
  if (!form) return;
  const msg = form.parentElement.querySelector("[data-messages]").dataset;
  const success = form.parentElement.querySelector("[data-success]");
  const summary = form.querySelector("[data-summary]");
  const $ = s => form.querySelector(s);
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const webRe = /^(@[\w.]{2,30}|(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?)$/i;

  const rules = {
    name: () => $("#f-name").value.trim().length >= 2,
    email: () => emailRe.test($("#f-email").value.trim()),
    company: () => $("#f-company").value.trim().length >= 2,
    website: () => { const v = $("#f-website").value.trim(); return !v || webRe.test(v); },
    topics: () => [...form.querySelectorAll("[data-topic]")].some(c => c.checked),
    message: () => $("#f-message").value.trim().length >= 20,
    consent: () => $("#f-consent").checked
  };
  let submitted = false;

  const show = (key, ok) => {
    const field = form.querySelector(`[data-field="${key}"]`);
    const err = field.querySelector("[data-error]");
    err.hidden = ok;
    err.textContent = ok ? "" : msg[key];
    if (key === "topics") { ok ? field.removeAttribute("data-invalid") : field.setAttribute("data-invalid", ""); form.querySelectorAll("[data-topic]").forEach(c => c.setAttribute("aria-invalid", String(!ok))); }
    else field.querySelector("input, textarea").setAttribute("aria-invalid", String(!ok));
    return ok;
  };
  const check = key => show(key, rules[key]());

  // validate a field when leaving it (after the first submit attempt, also while typing)
  form.addEventListener("focusout", e => {
    const field = e.target.closest("[data-field]");
    if (field && (submitted || e.target.value) && field.dataset.field !== "topics") check(field.dataset.field);
  });
  form.addEventListener("input", e => {
    const field = e.target.closest("[data-field]");
    if (submitted && field) check(field.dataset.field);
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    submitted = true;
    const bad = Object.keys(rules).filter(k => !check(k));
    if (bad.length) {
      summary.hidden = false;
      summary.textContent = msg.summary;
      const first = bad[0] === "topics" ? form.querySelector("[data-topic]") : form.querySelector(`[data-field="${bad[0]}"] input, [data-field="${bad[0]}"] textarea`);
      first.focus();
      return;
    }
    summary.hidden = true;
    form.hidden = true;
    success.hidden = false;
    success.focus();
  });

  success.querySelector("[data-again]").addEventListener("click", () => {
    form.reset();
    submitted = false;
    Object.keys(rules).forEach(k => show(k, true));
    success.hidden = true;
    form.hidden = false;
    $("#f-name").focus();
  });
}
