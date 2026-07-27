const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");
const heroVideoLayers = [...document.querySelectorAll("[data-hero-video-layer]")];

function updateHeaderState() {
  const shouldSolidify = window.scrollY > 12;
  header.classList.toggle("is-scrolled", shouldSolidify);
}

function closeNav() {
  header.classList.remove("is-open");
  document.body.classList.remove("nav-open");
  menuToggle.setAttribute("aria-expanded", "false");
}

function toggleNav() {
  const isOpen = header.classList.toggle("is-open");
  document.body.classList.toggle("nav-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
}

function setupSmoothHeroVideoLoop() {
  if (heroVideoLayers.length < 2) {
    return;
  }

  const crossfadeSeconds = 1.15;
  const resetOffsetSeconds = 0.08;
  const fadeDurationMs = 950;
  let activeIndex = 0;
  let isSwapping = false;
  let monitorFrame = 0;

  function showOnlyActiveLayer(index) {
    heroVideoLayers.forEach((video, layerIndex) => {
      video.classList.toggle("is-visible", layerIndex === index);
    });
  }

  function seekToStart(video) {
    if (video.readyState === 0) {
      video.load();
      return;
    }

    try {
      video.currentTime = resetOffsetSeconds;
    } catch {
      video.currentTime = 0;
    }
  }

  async function playVideo(video) {
    try {
      await video.play();
    } catch {
      // Muted autoplay can still be blocked until the browser is ready.
    }
  }

  function swapVideoLayers() {
    if (isSwapping) {
      return;
    }

    isSwapping = true;

    const currentVideo = heroVideoLayers[activeIndex];
    const nextIndex = (activeIndex + 1) % heroVideoLayers.length;
    const nextVideo = heroVideoLayers[nextIndex];

    seekToStart(nextVideo);
    nextVideo.classList.add("is-visible");
    playVideo(nextVideo);

    requestAnimationFrame(() => {
      currentVideo.classList.remove("is-visible");
    });

    window.setTimeout(() => {
      currentVideo.pause();
      seekToStart(currentVideo);
      activeIndex = nextIndex;
      showOnlyActiveLayer(activeIndex);
      isSwapping = false;
    }, fadeDurationMs);
  }

  function monitorActiveVideo() {
    const activeVideo = heroVideoLayers[activeIndex];

    if (
      activeVideo.duration &&
      Number.isFinite(activeVideo.duration) &&
      activeVideo.duration - activeVideo.currentTime <= crossfadeSeconds
    ) {
      swapVideoLayers();
    }

    monitorFrame = requestAnimationFrame(monitorActiveVideo);
  }

  heroVideoLayers.forEach((video, index) => {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.loop = false;
    seekToStart(video);

    video.addEventListener("ended", () => {
      if (index === activeIndex) {
        swapVideoLayers();
      }
    });
  });

  showOnlyActiveLayer(activeIndex);
  playVideo(heroVideoLayers[activeIndex]);
  monitorFrame = requestAnimationFrame(monitorActiveVideo);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelAnimationFrame(monitorFrame);
      heroVideoLayers.forEach((video) => video.pause());
      return;
    }

    playVideo(heroVideoLayers[activeIndex]);
    showOnlyActiveLayer(activeIndex);
    monitorFrame = requestAnimationFrame(monitorActiveVideo);
  });
}

async function submitContact(event) {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(contactForm));
  formStatus.classList.remove("error");
  formStatus.textContent = "Sending inquiry...";

  try {
    const response = await fetch("api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error || "Could not send your inquiry.");
    }

    formStatus.textContent = payload.message;
    contactForm.reset();
  } catch (error) {
    formStatus.classList.add("error");
    formStatus.textContent = error.message;
  }
}

menuToggle.addEventListener("click", toggleNav);
nav.addEventListener("click", (event) => {
  if (event.target instanceof HTMLAnchorElement) {
    closeNav();
  }
});

contactForm.addEventListener("submit", submitContact);
window.addEventListener("scroll", updateHeaderState, { passive: true });

updateHeaderState();
setupSmoothHeroVideoLoop();
