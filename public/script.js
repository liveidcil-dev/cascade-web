const header = document.querySelector("[data-header]");
const menuToggle = document.querySelector(".menu-toggle");
const nav = document.querySelector(".site-nav");
const portfolioGrid = document.querySelector("[data-portfolio-grid]");
const filterButtons = [...document.querySelectorAll("[data-filter]")];
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");

const portfolioItems = [
  {
    title: "Greenlake Multi 11-Unit",
    neighborhood: "Green Lake",
    type: "multifamily",
    image: "assets/greenlake.jpg",
    description:
      "A larger multifamily asset where leasing, maintenance, and resident communication need to stay tightly coordinated."
  },
  {
    title: "Capitol Hill Fourplex",
    neighborhood: "Capitol Hill",
    type: "multifamily",
    image: "assets/capitol-hill.jpg",
    description:
      "Long-term multifamily management in one of Seattle's highest-demand rental neighborhoods."
  },
  {
    title: "Ballard Single Family",
    neighborhood: "Ballard",
    type: "single",
    image: "assets/ballard.jpg",
    description:
      "A classic Seattle home supported through turnover planning, leasing, and ongoing owner communication."
  },
  {
    title: "Madison Valley Single",
    neighborhood: "Madison Valley",
    type: "single",
    image: "assets/madison-valley.jpg",
    description:
      "Residential management in a central neighborhood with careful resident selection and asset oversight."
  },
  {
    title: "Portage Bay Residence",
    neighborhood: "Portage Bay",
    type: "single",
    image: "assets/portage-bay.jpg",
    description:
      "Single-family property management near Seattle's lakefront rental corridors."
  },
  {
    title: "Central District Portfolio",
    neighborhood: "Central District",
    type: "multifamily",
    image: "assets/central-area.jpg",
    description:
      "Homes and small multifamily assets managed around occupancy, maintenance, and neighborhood context."
  },
  {
    title: "Greenwood Mixed Use",
    neighborhood: "Greenwood",
    type: "commercial",
    image: "assets/greenlake.jpg",
    description:
      "Residential and retail use coordinated across maintenance, resident needs, and property performance."
  },
  {
    title: "Crown Hill Commercial",
    neighborhood: "Crown Hill",
    type: "commercial",
    image: "assets/ballard.jpg",
    description:
      "Commercial rental management with practical owner reporting and vendor coordination."
  },
  {
    title: "Burien Multi 6-Units",
    neighborhood: "Burien",
    type: "multifamily",
    image: "assets/madison-valley.jpg",
    description:
      "Management continuity through ownership transitions and stabilization of a small multifamily asset."
  }
];

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

function normalizeType(value) {
  return value
    .split(" ")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function portfolioCard(item) {
  return `
    <article class="portfolio-card">
      <img src="${item.image}" alt="${item.title} in ${item.neighborhood}" decoding="async" />
      <div class="portfolio-card-body">
        <div class="portfolio-meta">
          <span>${normalizeType(item.type)}</span>
          <span>${item.neighborhood}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
    </article>
  `;
}

function renderPortfolio(filter = "all") {
  const visibleItems =
    filter === "all" ? portfolioItems : portfolioItems.filter((item) => item.type === filter);

  portfolioGrid.innerHTML = visibleItems.map(portfolioCard).join("");
}

async function submitContact(event) {
  event.preventDefault();

  const data = Object.fromEntries(new FormData(contactForm));
  formStatus.classList.remove("error");
  formStatus.textContent = "Saving inquiry...";

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
      throw new Error(payload.error || "Could not save your inquiry.");
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

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderPortfolio(button.dataset.filter);
  });
});

contactForm.addEventListener("submit", submitContact);
window.addEventListener("scroll", updateHeaderState, { passive: true });

updateHeaderState();
renderPortfolio();
