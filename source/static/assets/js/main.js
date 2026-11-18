// Entry: small modules, scene code only when motion is allowed.
import { initNav } from "./nav.js";
import { initMedia } from "./media.js";
import { initFilter } from "./filter.js";
import { initForm } from "./form.js";

const motion = document.documentElement.classList.contains("motion");
initNav();
initMedia(motion);
initFilter();
initForm();
// marker for the scroll-craft screenshot harness (verification only, no styling attached)
document.documentElement.classList.add("sc-ready");
// pinned scenes only on wide screens; phones and tablets get the calm static layout
if (document.documentElement.classList.contains("scenes") && document.querySelector("[data-act]")) {
  import("./scenes.js").then(m => m.initScenes());
}
