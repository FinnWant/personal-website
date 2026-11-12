// Shared behaviour for every page. Keep page-specific scripts (e.g. the visit
// counter) inline on their own page rather than adding them here.
(() => {
  // Footer year — any number of elements, no per-page IDs needed.
  const year = new Date().getFullYear();
  document.querySelectorAll(".js-year").forEach((el) => {
    el.textContent = year;
  });

  // Scroll fade-in. JS adds .reveal itself, so content stays visible
  // if this script never runs. Skipped entirely for reduced-motion users.
  if (matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    const io = new IntersectionObserver(
      (entries) => {
        // Items entering together (a row of cards) appear one after another.
        entries
          .filter((e) => e.isIntersecting)
          .forEach((e, i) => {
            e.target.style.setProperty("--reveal-delay", `${i * 70}ms`);
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          });
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    document
      .querySelectorAll(
        ".Recent-Projects > h2, .highlights > h2, .card, .highlight, .about-section, .contact, .post-list li"
      )
      .forEach((el) => {
        el.classList.add("reveal");
        io.observe(el);
      });
  }

  // Cursor spotlight on cards and post rows (mouse only; works with reduced motion too,
  // since nothing moves — only a glow's position changes).
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
    document.querySelectorAll(".card, .post-list li").forEach((el) => {
      el.classList.add("spot");
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--sx", `${e.clientX - r.left}px`);
        el.style.setProperty("--sy", `${e.clientY - r.top}px`);
      });
    });
  }

  // Header over a dark band (body.has-hero): transparent so the motion field shows behind
  // the nav. --header-h pulls the band up under it; .header--glass frosts it once the page
  // moves; .header--scrolled restores the light header once the band has passed beneath.
  (() => {
    const header = document.querySelector(".site-header");
    const hero = document.querySelector(".has-hero .hero--dark");
    if (!header || !hero) return;
    const toggle = header.querySelector(".nav-toggle");
    const root = document.documentElement;
    // The see-through styles only apply from here on (see .header--live in styles.css).
    header.classList.add("header--live");
    // The open mobile menu makes the header taller; keep the closed height.
    const measure = () => {
      if (toggle && toggle.getAttribute("aria-expanded") === "true") return;
      root.style.setProperty("--header-h", `${header.offsetHeight}px`);
    };
    measure();
    if ("ResizeObserver" in window) new ResizeObserver(measure).observe(header);
    // Cheap enough to run on every scroll event; no rAF so it can't lag behind a jump.
    const update = () => {
      header.classList.toggle("header--glass", scrollY > 8);
      header.classList.toggle("header--scrolled", hero.getBoundingClientRect().bottom <= header.offsetHeight);
    };
    addEventListener("scroll", update, { passive: true });
    update();
  })();

  // Motion field (the animated dot backdrop on the dark blocks). Pauses its CSS loops
  // while off-screen, and on mouse devices lights the dots under the pointer by moving
  // --mx/--my. Reduced-motion users keep the static field: nothing here runs.
  if (matchMedia("(prefers-reduced-motion: no-preference)").matches) {
    const fields = document.querySelectorAll(".motion-field");
    const vis = new IntersectionObserver((entries) => {
      entries.forEach((e) => e.target.classList.toggle("is-paused", !e.isIntersecting));
    });
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    fields.forEach((field) => vis.observe(field));
    // Listen on the window, not the block: the transparent home header sits over the hero,
    // so the pointer can be over the field while the event target is the nav.
    if (fine && fields.length) {
      let frame = 0;
      let last = null;
      const paint = () => {
        frame = 0;
        fields.forEach((field) => {
          const r = field.getBoundingClientRect();
          const x = last.clientX - r.left;
          const y = last.clientY - r.top;
          const inside = x >= 0 && y >= 0 && x <= r.width && y <= r.height;
          field.classList.toggle("is-lit", inside);
          if (inside) {
            field.style.setProperty("--mx", `${x}px`);
            field.style.setProperty("--my", `${y}px`);
          }
        });
      };
      addEventListener("pointermove", (e) => {
        last = e;
        if (!frame) frame = requestAnimationFrame(paint);
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", () => {
        fields.forEach((field) => field.classList.remove("is-lit"));
      });
    }
  }

  // Mobile nav.
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => {
    setOpen(toggle.getAttribute("aria-expanded") !== "true");
  });

  // Close on Escape so keyboard users aren't trapped in an open menu.
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });

  // Reset when resizing back to the desktop layout, where the menu is always visible.
  window.matchMedia("(min-width: 761px)").addEventListener("change", (e) => {
    if (e.matches) setOpen(false);
  });
})();
