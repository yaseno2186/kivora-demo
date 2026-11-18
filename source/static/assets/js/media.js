// Hero lens video and ending marquee: play only with motion allowed and on screen; a pause button for both.
// The paused choice is kept in sessionStorage for this tab only.
const store = {
  get: k => { try { return sessionStorage.getItem(k) === "1"; } catch { return false; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v ? "1" : "0"); } catch { /* storage blocked: fine */ } }
};

function bindToggle(btn, paused, onChange) {
  btn.hidden = false;
  const render = p => { btn.setAttribute("aria-pressed", String(p)); btn.textContent = p ? btn.dataset.labelPlay : btn.dataset.labelPause; };
  render(paused);
  btn.addEventListener("click", () => { paused = !paused; render(paused); onChange(paused); });
}

export function initMedia(motion) {
  const poster = document.querySelector("[data-video]");
  const vBtn = document.querySelector("[data-video-toggle]");
  if (poster && vBtn) {
    // The HTML ships only the poster image. The <video> is created after window load and only
    // when it will play, so it never delays the load event or competes with the LCP image.
    let video = null;
    const make = () => {
      video = document.createElement("video");
      Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "auto", poster: poster.currentSrc || poster.src });
      video.className = poster.className;
      video.setAttribute("aria-label", poster.alt);
      video.setAttribute("muted", "");
      for (const [type, src] of [["video/webm", poster.dataset.webm], ["video/mp4", poster.dataset.mp4]]) {
        const s = document.createElement("source"); s.src = src; s.type = type; video.append(s);
      }
      video.style.transform = poster.style.transform;
      poster.replaceWith(video);
      video.addEventListener("error", () => video.replaceWith(poster), { once: true });
    };
    let paused = motion ? store.get("kivora-video-paused") : true; // reduced motion: never autoplay
    let visible = false, loaded = document.readyState === "complete";
    // start the video only after window load: keeps it out of the LCP window, and some engines
    // delay the load event while a media element is still selecting its source
    const sync = () => {
      if (!paused && visible && loaded) { if (!video) make(); video.play().catch(() => {}); }
      else if (video && !video.paused) video.pause();
    };
    if (!loaded) addEventListener("load", () => { loaded = true; sync(); }, { once: true });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(poster.parentElement);
    bindToggle(vBtn, paused, p => { paused = p; if (motion) store.set("kivora-video-paused", p); sync(); });
  }

  const marquee = document.querySelector("[data-marquee]");
  const mBtn = document.querySelector("[data-marquee-toggle]");
  if (marquee && mBtn && motion) {
    let paused = store.get("kivora-marquee-paused");
    let visible = false;
    const sync = () => marquee.classList.toggle("is-paused", paused || !visible);
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; sync(); }).observe(marquee);
    bindToggle(mBtn, paused, p => { paused = p; store.set("kivora-marquee-paused", p); sync(); });
  }
}
