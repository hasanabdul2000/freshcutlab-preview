/* =========================================================
   FRESH CUT LAB — main.js
   Modifica CONFIG per cambiare orari, numero e giorni di chiusura.
   ========================================================= */
const CONFIG = {
  whatsapp: "393288934144",            // numero WhatsApp (con prefisso 39, senza +)
  // Orari per giorno della settimana (0 = domenica … 6 = sabato). null = chiuso.
  hours: {
    0: null,
    1: null,
    2: ["09:00", "20:00"],
    3: ["09:00", "20:00"],
    4: ["09:00", "20:00"],
    5: ["09:00", "20:00"],
    6: ["09:00", "19:00"],
  },
  slotMinutes: 30,
  daysAhead: 28,
};

const DAY_NAMES = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
const DAY_SHORT = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const waUrl = (text) => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text)}`;
const store = {
  get() { try { return JSON.parse(localStorage.getItem("fcl_bookings") || "[]"); } catch { return []; } },
  set(v) { try { localStorage.setItem("fcl_bookings", JSON.stringify(v)); } catch {} },
};

/* ---------------- loader ---------------- */
let loadPct = 0;
const loaderBar = $("#loaderBar"), loaderPct = $("#loaderPct");
const loaderTick = setInterval(() => {
  loadPct = Math.min(loadPct + Math.random() * 18, 92);
  loaderBar.style.width = loadPct + "%"; loaderPct.textContent = Math.round(loadPct);
}, 120);
let heroReady = null;
const heroReadyP = new Promise((r) => (heroReady = r));
function finishLoader() {
  clearInterval(loaderTick);
  loaderBar.style.width = "100%"; loaderPct.textContent = "100";
  setTimeout(() => { $("#loader").classList.add("is-done"); introAnim(); }, 250);
}
Promise.race([heroReadyP, new Promise((r) => setTimeout(r, 4500))]).then(finishLoader);

/* ---------------- static bits ---------------- */
$("#year").textContent = new Date().getFullYear();
$("#waLink").href = waUrl("Ciao Fresh Cut Lab! Vorrei qualche informazione.");
$("#promoWa").href = waUrl("Ciao! Ho il codice FCL30 e vorrei attivare l'abbonamento.");

// burger
const burger = $("#burger"), mm = $("#mobileMenu");
burger.addEventListener("click", () => {
  const open = burger.getAttribute("aria-expanded") !== "true";
  burger.setAttribute("aria-expanded", open); mm.classList.toggle("is-open", open);
});
$$("a", mm).forEach((a) => a.addEventListener("click", () => { burger.setAttribute("aria-expanded", "false"); mm.classList.remove("is-open"); }));

// hours list
(function renderHours() {
  const dl = $("#hoursList"); const today = new Date().getDay();
  [2, 3, 4, 5, 6, 0, 1].forEach((d) => {
    const h = CONFIG.hours[d];
    const dt = document.createElement("dt"); dt.textContent = DAY_NAMES[d];
    const dd = document.createElement("dd");
    dd.textContent = h ? `${h[0]} – ${h[1]}` : "Chiuso";
    if (!h) dd.classList.add("closed");
    if (d === today) { dt.classList.add("today"); dd.classList.add("today"); }
    dl.append(dt, dd);
  });
})();

/* ---------------- custom cursor + magnetic ---------------- */
const cursor = $("#cursor");
let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
addEventListener("pointermove", (e) => { tx = e.clientX; ty = e.clientY; cursor.style.opacity = 1; }, { passive: true });
(function cursorLoop() {
  cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2;
  cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  requestAnimationFrame(cursorLoop);
})();
document.addEventListener("pointerover", (e) => {
  cursor.classList.toggle("is-hover", !!e.target.closest("a, button, .choice, .day, .slot"));
});
if (matchMedia("(hover: hover)").matches && !reduceMotion) {
  $$(".magnetic").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      el.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    el.addEventListener("pointerleave", () => (el.style.transform = ""));
  });
  // 3D tilt
  $$(".tilt").forEach((el) => {
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty("--ry", `${(px - 0.5) * 14}deg`);
      el.style.setProperty("--rx", `${(0.5 - py) * 12}deg`);
      el.style.setProperty("--mx", `${px * 100}%`);
      el.style.setProperty("--my", `${py * 100}%`);
    });
    el.addEventListener("pointerleave", () => { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); });
  });
  // CSS 3D type follows the mouse
  addEventListener("pointermove", (e) => {
    const x = e.clientX / innerWidth - 0.5, y = e.clientY / innerHeight - 0.5;
    $$(".footer__big .type3d, .hero__fallback .type3d").forEach((t) => {
      t.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`;
    });
  }, { passive: true });
}

/* =========================================================
   HERO 3D — Three.js extruded gold typography
   ========================================================= */
const hero = $("#hero");
const heroState = { scroll: 0, mx: 0, my: 0, intro: 0 };
let heroLetters = [];

(async function initHero3D() {
  try {
    const THREE = await import("three");
    const { FontLoader } = await import("three/addons/loaders/FontLoader.js");
    const { TextGeometry } = await import("three/addons/geometries/TextGeometry.js");
    const { RoomEnvironment } = await import("three/addons/environments/RoomEnvironment.js");

    const canvas = $("#hero3d");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    const key = new THREE.DirectionalLight(0xffe2b0, 2.2); key.position.set(4, 6, 8); scene.add(key);
    const rim = new THREE.PointLight(0xffb84d, 30, 30); rim.position.set(-6, -2, 4); scene.add(rim);
    const mouseLight = new THREE.PointLight(0xfff0d0, 40, 18); mouseLight.position.set(0, 0, 5); scene.add(mouseLight);

    const font = await new Promise((res, rej) =>
      new FontLoader().load("https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json", res, undefined, rej)
    );

    const gold = new THREE.MeshStandardMaterial({ color: 0xe0ad55, metalness: 1, roughness: 0.26 });
    const goldDark = new THREE.MeshStandardMaterial({ color: 0x8a5d22, metalness: 1, roughness: 0.4 });

    const group = new THREE.Group(); scene.add(group);
    const SIZE = 1, SY = 1.22;
    const makeLetter = (ch) => {
      const geo = new TextGeometry(ch, {
        font, size: SIZE, height: 0.42, depth: 0.42, curveSegments: 8,
        bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 5,
      });
      geo.computeBoundingBox();
      const bb = geo.boundingBox;
      geo.translate(-(bb.max.x + bb.min.x) / 2, -(bb.max.y + bb.min.y) / 2, -0.21);
      const mesh = new THREE.Mesh(geo, [gold, goldDark]);
      mesh.scale.y = SY;
      const glyph = font.data.glyphs[ch];
      const adv = (glyph ? glyph.ha : 600) / font.data.resolution * SIZE;
      return { mesh, adv, w: bb.max.x - bb.min.x };
    };

    const words = ["FRESH", "CUT"];
    const wordObjs = words.map((w) => [...w].map((ch) => {
      const L = makeLetter(ch);
      L.seed = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2, z: Math.random(), r: (Math.random() - 0.5) * 2, p: Math.random() * Math.PI * 2 };
      group.add(L.mesh);
      return L;
    }));
    heroLetters = wordObjs.flat();

    // gold dust
    const dustN = 500, dustPos = new Float32Array(dustN * 3);
    for (let i = 0; i < dustN; i++) { dustPos[i * 3] = (Math.random() - 0.5) * 30; dustPos[i * 3 + 1] = (Math.random() - 0.5) * 18; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2; }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute("position", new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xf0c878, size: 0.045, transparent: true, opacity: 0.7, depthWrite: false }));
    scene.add(dust);

    // layout: one line on wide screens, two lines on tall ones
    let lineMode = 0;
    function layout() {
      const w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const aspect = w / h;
      lineMode = aspect > 1.15 ? 1 : 2;
      const gap = 0.45;
      const lines = lineMode === 1 ? [wordObjs[0].concat([{ space: true }], wordObjs[1])] : [wordObjs[0], wordObjs[1]];
      const lineH = SIZE * SY * 1.18;
      let maxW = 0;
      lines.forEach((line, li) => {
        const total = line.reduce((s, L) => s + (L.space ? gap : L.adv), 0);
        maxW = Math.max(maxW, total);
        let x = -total / 2;
        const y = (lines.length - 1) * lineH / 2 - li * lineH + 0.35;
        line.forEach((L) => {
          if (L.space) { x += gap; return; }
          L.base = { x: x + L.adv / 2, y };
          x += L.adv;
        });
      });
      // fit width to ~82% of the viewport
      const vFov = camera.fov * Math.PI / 180;
      const targetW = maxW / 0.82;
      const distW = targetW / 2 / Math.tan(vFov / 2) / camera.aspect;
      const distH = (lines.length * lineH + 2.2) / 2 / Math.tan(vFov / 2);
      camera.position.z = Math.max(distW, distH, 6);
    }
    layout();
    addEventListener("resize", layout);

    addEventListener("pointermove", (e) => {
      heroState.mx = e.clientX / innerWidth * 2 - 1;
      heroState.my = e.clientY / innerHeight * 2 - 1;
    }, { passive: true });

    let visible = true;
    new IntersectionObserver(([en]) => (visible = en.isIntersecting)).observe(hero);

    const clock = new THREE.Clock();
    let rx = 0, ry = 0;
    function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      const t = clock.getElapsedTime();
      const s = heroState.scroll, intro = heroState.intro;
      ry += (heroState.mx * 0.35 - ry) * 0.05;
      rx += (heroState.my * 0.22 - rx) * 0.05;
      group.rotation.y = ry + s * 0.6;
      group.rotation.x = rx + s * 0.35;
      group.position.y = s * 1.2;

      heroLetters.forEach((L, i) => {
        const sd = L.seed, inv = 1 - intro;
        const float = reduceMotion ? 0 : Math.sin(t * 1.2 + sd.p) * 0.06;
        L.mesh.position.set(
          L.base.x + sd.x * (inv * 6 + s * 7),
          L.base.y + float + sd.y * (inv * 4 + s * 5),
          sd.z * (-inv * 14 + s * 9)
        );
        L.mesh.rotation.set(sd.r * (inv * 3 + s * 2.5), sd.y * (inv * 2.5 + s * 3) + Math.sin(t * 0.8 + i) * 0.04, sd.x * (inv * 1.5 + s * 1.2));
      });
      mouseLight.position.set(heroState.mx * 6, -heroState.my * 4, 5);
      dust.rotation.y = t * 0.02 + s * 0.4;
      dust.position.y = -s * 3 + Math.sin(t * 0.3) * 0.2;
      renderer.render(scene, camera);
    }
    frame();
    heroReady();
  } catch (err) {
    console.warn("WebGL hero non disponibile, uso fallback CSS", err);
    hero.classList.add("no-webgl");
    heroState.intro = 1;
    heroReady();
  }
})();

/* =========================================================
   GSAP + Lenis
   ========================================================= */
let lenis = null;
function setupScroll() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) { $$(".split-words .w").forEach((w) => (w.style.opacity = 1)); return; }
  gsap.registerPlugin(ScrollTrigger);

  if (window.Lenis && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    // anchors through Lenis
    $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
      const id = a.getAttribute("href"); if (id.length < 2) return;
      const el = $(id); if (!el) return;
      e.preventDefault(); lenis.scrollTo(el, { offset: id === "#top" ? 0 : -60, duration: 1.4 });
    }));
  }

  // nav state
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => {
      const y = self.scroll();
      $("#nav").classList.toggle("is-scrolled", y > 40);
      $("#nav").classList.toggle("is-hidden", y > lastY && y > 600 && !mm.classList.contains("is-open"));
      $("#fab").classList.toggle("is-on", y > innerHeight * 0.8 && !isInView($("#prenota")));
      lastY = y;
    },
  });

  // hero scroll -> 3D scatter
  ScrollTrigger.create({
    trigger: hero, start: "top top", end: "bottom top", scrub: true,
    onUpdate: (self) => (heroState.scroll = self.progress),
  });
  gsap.to(".hero__content, .hero__top, .hero__scroll", { yPercent: -40, opacity: 0, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "60% top", scrub: true } });

  // marquee: endless + velocity skew
  $$(".marquee__row").forEach((row) => {
    const inner = $(".marquee__inner", row);
    row.append(inner.cloneNode(true), inner.cloneNode(true));
    const dir = +row.dataset.dir;
    const w = inner.offsetWidth;
    const tween = gsap.fromTo(row, { x: dir > 0 ? 0 : -w }, { x: dir > 0 ? -w : 0, duration: 22, ease: "none", repeat: -1 });
    ScrollTrigger.create({
      trigger: ".marquee", start: "top bottom", end: "bottom top",
      onUpdate: (self) => {
        const v = self.getVelocity();
        gsap.to(tween, { timeScale: 1 + Math.min(Math.abs(v) / 400, 5), duration: 0.2, overwrite: true });
        gsap.to(row, { skewX: gsap.utils.clamp(-12, 12, v / -160) * dir, duration: 0.4, overwrite: "auto" });
      },
    });
  });

  // manifesto word reveal
  const words = $$(".split-words .w");
  gsap.to(words, { opacity: 1, stagger: 0.05, ease: "none", scrollTrigger: { trigger: ".manifesto__text", start: "top 80%", end: "bottom 45%", scrub: true } });

  // counters
  $$("[data-count]").forEach((el) => {
    const obj = { v: 0 }, to = +el.dataset.count, suf = el.dataset.suffix || "";
    gsap.to(obj, { v: to, duration: 1.8, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%" }, onUpdate: () => (el.textContent = Math.round(obj.v) + suf) });
  });

  // 3D titles: rotate up from below
  $$(".title3d").forEach((t) => {
    gsap.from(t.children, { rotateX: -85, y: 60, opacity: 0, duration: 1.2, stagger: 0.12, ease: "expo.out", scrollTrigger: { trigger: t, start: "top 85%" } });
  });

  // generic reveals
  gsap.utils.toArray(".plan, .promo, .step, .relax__list li, .booker, .where__map, .stat").forEach((el) => {
    gsap.from(el, { y: 70, opacity: 0, duration: 1.1, ease: "expo.out", scrollTrigger: { trigger: el, start: "top 90%" } });
  });

  const mmq = gsap.matchMedia();
  // horizontal services
  mmq.add("(min-width: 761px)", () => {
    const track = $("#servicesTrack");
    const dist = () => track.scrollWidth - innerWidth + 40;
    const tl = gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: ".services", pin: ".services__pin", start: "top top", end: () => "+=" + dist(), scrub: 1, invalidateOnRefresh: true } });
    $$(".scard", track).forEach((c) => {
      gsap.fromTo(c, { rotateY: -18, z: -80 }, { rotateY: 0, z: 0, ease: "none", scrollTrigger: { trigger: c, containerAnimation: tl, start: "left right", end: "center center", scrub: true } });
    });
    return () => gsap.set(track, { clearProps: "x" });
  });
  mmq.add("(max-width: 760px)", () => {
    $$(".scard").forEach((c) => gsap.from(c, { y: 60, opacity: 0, duration: 1, ease: "expo.out", scrollTrigger: { trigger: c, start: "top 90%" } }));
  });

  // plans background word parallax
  gsap.fromTo(".plans__bgword", { xPercent: -30 }, { xPercent: -70, ease: "none", scrollTrigger: { trigger: ".plans", start: "top bottom", end: "bottom top", scrub: true } });

  // relax image parallax
  gsap.fromTo(".relax__media img", { yPercent: -12 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".relax", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.from(".relax__media", { clipPath: "inset(30% 30% 30% 30% round 28px)", ease: "none", scrollTrigger: { trigger: ".relax__media", start: "top 95%", end: "center 55%", scrub: true } });

  // salon clip-path zoom
  gsap.to("#salonFrame", { clipPath: "inset(0% 0% 0% 0% round 32px)", ease: "none", scrollTrigger: { trigger: ".salon", start: "top 85%", end: "center 55%", scrub: true } });
  gsap.to("#salonFrame img", { scale: 1, ease: "none", scrollTrigger: { trigger: ".salon", start: "top bottom", end: "bottom top", scrub: true } });

  // footer giant 3D type
  gsap.from(".footer__big .type3d", { rotateX: 70, y: 120, opacity: 0, ease: "none", scrollTrigger: { trigger: ".footer", start: "top bottom", end: "top 40%", scrub: true } });

  addEventListener("load", () => ScrollTrigger.refresh());
}
function isInView(el) { const r = el.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }

// split manifesto into words (before GSAP)
$$(".split-words").forEach((el) => {
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(" ");
});

function introAnim() {
  const { gsap } = window;
  if (!gsap) { heroState.intro = 1; return; }
  gsap.to(heroState, { intro: 1, duration: reduceMotion ? 0.01 : 2.4, ease: "expo.out" });
  gsap.fromTo(".hero__top .pill, .hero__lab, .hero__claim, .hero__cta", { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.1, delay: 0.6, ease: "expo.out", clearProps: "transform" });
  gsap.from(".nav > *", { y: -30, opacity: 0, duration: 1, stagger: 0.06, delay: 0.4, ease: "expo.out" });
  gsap.from(".hero__fallback .type3d", { rotateX: 80, y: 80, opacity: 0, duration: 1.4, stagger: 0.12, ease: "expo.out" });
}

if (document.readyState === "complete" || window.gsap) setupScroll();
else addEventListener("DOMContentLoaded", setupScroll);

/* =========================================================
   PRENOTAZIONE
   ========================================================= */
const booking = { service: null, type: "Ho già l'abbonamento", date: null, time: null };
let step = 1, dayOffset = 0;
const booker = $("#booker");

const pad = (n) => String(n).padStart(2, "0");
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const longDate = (d) => `${DAY_NAMES[d.getDay()].toLowerCase()} ${d.getDate()} ${MONTHS[d.getMonth()]}`;

function goStep(n) {
  step = n;
  $$(".bstep", booker).forEach((s) => s.classList.toggle("is-active", +s.dataset.step === n));
  $$("[data-step-ind]", booker).forEach((li) => {
    const i = +li.dataset.stepInd;
    li.classList.toggle("is-active", i === n);
    li.classList.toggle("is-done", i < n);
  });
  if (n === 2) renderDays();
  if (n === 3) renderSlots();
  if (n === 4) renderSummary();
  const top = booker.getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * 0.6) {
    lenis ? lenis.scrollTo(booker, { offset: -90, duration: 0.9 }) : booker.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}
function updateNext() {
  const cur = $(`.bstep[data-step="${step}"]`, booker);
  const next = $("[data-next]", cur);
  if (!next) return;
  next.disabled = (step === 1 && !booking.service) || (step === 2 && !booking.date) || (step === 3 && !booking.time);
}
booker.addEventListener("click", (e) => {
  if (e.target.closest("[data-next]")) goStep(step + 1);
  if (e.target.closest("[data-prev]")) goStep(step - 1);
});

// step 1
$$("#serviceChoices .choice").forEach((b) => b.addEventListener("click", () => {
  $$("#serviceChoices .choice").forEach((x) => x.classList.toggle("is-on", x === b));
  booking.service = b.dataset.service; updateNext();
}));
function setType(t) {
  booking.type = t;
  $$("#typeChoices .seg__btn").forEach((x) => x.classList.toggle("is-on", x.dataset.type === t));
}
$$("#typeChoices .seg__btn").forEach((b) => b.addEventListener("click", () => setType(b.dataset.type)));

// plan buttons -> preselect in booking
$$("[data-plan]").forEach((b) => b.addEventListener("click", () => {
  const plan = b.dataset.plan;
  const svc = plan === "Solo capelli" ? "Taglio" : "Taglio + barba";
  $$("#serviceChoices .choice").forEach((x) => x.classList.toggle("is-on", x.dataset.service === svc));
  booking.service = svc; booking.plan = plan;
  setType("Voglio attivare l'abbonamento");
  goStep(1); updateNext();
  const target = $("#prenota");
  lenis ? lenis.scrollTo(target, { offset: -60, duration: 1.4 }) : target.scrollIntoView({ behavior: "smooth" });
}));

// step 2: days
function openDays() {
  const out = [], now = new Date();
  for (let i = 0; i < CONFIG.daysAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push(d);
  }
  return out;
}
function daySlots(d) {
  const h = CONFIG.hours[d.getDay()];
  if (!h) return [];
  const taken = new Set(store.get().filter((b) => b.date === dateKey(d)).map((b) => b.time));
  const now = new Date(), isToday = dateKey(d) === dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes() + 30;
  const res = [];
  for (let m = toMin(h[0]); m + CONFIG.slotMinutes <= toMin(h[1]); m += CONFIG.slotMinutes) {
    res.push({ time: fmtMin(m), off: (isToday && m < nowMin) || taken.has(fmtMin(m)) });
  }
  return res;
}
function renderDays() {
  const all = openDays();
  const perPage = innerWidth <= 760 ? 8 : 14;
  dayOffset = Math.max(0, Math.min(dayOffset, all.length - perPage));
  const page = all.slice(dayOffset, dayOffset + perPage);
  const wrap = $("#days"); wrap.innerHTML = "";
  page.forEach((d) => {
    const slots = daySlots(d), free = slots.filter((s) => !s.off).length;
    const b = document.createElement("button");
    b.className = "day"; b.disabled = free === 0;
    if (booking.date === dateKey(d)) b.classList.add("is-on");
    const isToday = dateKey(d) === dateKey(new Date());
    b.innerHTML = `<small>${isToday ? "Oggi" : DAY_SHORT[d.getDay()]}</small><b>${d.getDate()}</b><em>${slots.length ? (free ? MONTHS[d.getMonth()].slice(0, 3) : "pieno") : "chiuso"}</em>`;
    b.addEventListener("click", () => {
      if (booking.date !== dateKey(d)) booking.time = null;
      booking.date = dateKey(d);
      $$(".day", wrap).forEach((x) => x.classList.toggle("is-on", x === b)); updateNext();
    });
    wrap.append(b);
  });
  const first = page[0], last = page[page.length - 1];
  $("#monthLabel").textContent = first.getMonth() === last.getMonth()
    ? `${MONTHS[first.getMonth()]} ${first.getFullYear()}`
    : `${MONTHS[first.getMonth()].slice(0, 3)} – ${MONTHS[last.getMonth()].slice(0, 3)} ${last.getFullYear()}`;
  $("#daysPrev").disabled = dayOffset === 0;
  $("#daysNext").disabled = dayOffset + perPage >= all.length;
  const closed = [0, 1, 2, 3, 4, 5, 6].filter((i) => !CONFIG.hours[i]).map((i) => DAY_NAMES[i].toLowerCase());
  $("#closedHint").textContent = closed.length ? `Chiuso ${closed.join(" e ")}.` : "";
  updateNext();
}
$("#daysPrev").addEventListener("click", () => { dayOffset -= innerWidth <= 760 ? 8 : 14; renderDays(); });
$("#daysNext").addEventListener("click", () => { dayOffset += innerWidth <= 760 ? 8 : 14; renderDays(); });

// step 3: slots
function renderSlots() {
  const d = fromKey(booking.date);
  $("#slotsTitle").textContent = `Orari · ${longDate(d)}`;
  const wrap = $("#slots"); wrap.innerHTML = "";
  const groups = [["Mattina", 0, 13 * 60], ["Pomeriggio", 13 * 60, 17 * 60], ["Sera", 17 * 60, 24 * 60]];
  const slots = daySlots(d);
  groups.forEach(([label, a, b]) => {
    const g = slots.filter((s) => toMin(s.time) >= a && toMin(s.time) < b);
    if (!g.length) return;
    const h = document.createElement("div"); h.className = "slots__group"; h.textContent = label; wrap.append(h);
    g.forEach((s) => {
      const btn = document.createElement("button");
      btn.className = "slot"; btn.textContent = s.time; btn.disabled = s.off;
      if (booking.time === s.time) btn.classList.add("is-on");
      btn.addEventListener("click", () => {
        booking.time = s.time;
        $$(".slot", wrap).forEach((x) => x.classList.toggle("is-on", x === btn)); updateNext();
      });
      wrap.append(btn);
    });
  });
  updateNext();
}

// step 4: summary + confirm
function renderSummary() {
  const d = fromKey(booking.date);
  const rows = [["Servizio", booking.service], ["Tipo", booking.type], booking.plan && booking.type.startsWith("Voglio") ? ["Piano", booking.plan] : null, ["Giorno", longDate(d)], ["Orario", booking.time]].filter(Boolean);
  $("#summary").innerHTML = `<h4>Riepilogo</h4><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}
$("#confirmBtn").addEventListener("click", () => {
  const f = $("#bookingForm");
  const name = f.name.value.trim(), phone = f.phone.value.trim(), code = f.code.value.trim().toUpperCase(), notes = f.notes.value.trim();
  f.name.classList.toggle("is-err", name.length < 2);
  const phoneOk = phone.replace(/[^\d]/g, "").length >= 8;
  f.phone.classList.toggle("is-err", !phoneOk);
  if (name.length < 2 || !phoneOk) { $("#formErr").textContent = "Inserisci nome e un numero di telefono valido."; return; }
  $("#formErr").textContent = "";

  const d = fromKey(booking.date);
  const lines = [
    "Ciao Fresh Cut Lab! Vorrei prenotare:",
    `• Servizio: ${booking.service}`,
    `• ${booking.type}${booking.plan && booking.type.startsWith("Voglio") ? ` (${booking.plan})` : ""}`,
    `• Giorno: ${longDate(d)}`,
    `• Orario: ${booking.time}`,
    `• Nome: ${name}`,
    `• Telefono: ${phone}`,
  ];
  if (code) lines.push(`• Codice: ${code}`);
  if (notes) lines.push(`• Note: ${notes}`);
  window.open(waUrl(lines.join("\n")), "_blank", "noopener");

  const rec = { id: Date.now(), ...booking, name };
  store.set([...store.get(), rec]);
  lastBooking = rec;
  $("#doneText").textContent = `${booking.service} · ${longDate(d)} alle ${booking.time}. Il messaggio è pronto su WhatsApp: invialo e il barbiere ti confermerà il posto.`;
  goStep(5);
  renderMine();
});
let lastBooking = null;
$("#newBooking").addEventListener("click", () => {
  Object.assign(booking, { service: null, date: null, time: null, plan: null });
  $$("#serviceChoices .choice").forEach((x) => x.classList.remove("is-on"));
  $("#bookingForm").reset(); goStep(1); updateNext();
});
$("#icsBtn").addEventListener("click", () => {
  if (!lastBooking) return;
  const d = fromKey(lastBooking.date), start = toMin(lastBooking.time), end = start + (lastBooking.service === "Taglio + barba" ? 45 : 30);
  const dt = (m) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(m / 60))}${pad(m % 60)}00`;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Fresh Cut Lab//IT", "BEGIN:VEVENT",
    `UID:${lastBooking.id}@freshcutlab`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
    `DTSTART;TZID=Europe/Rome:${dt(start)}`, `DTEND;TZID=Europe/Rome:${dt(end)}`,
    `SUMMARY:Fresh Cut Lab — ${lastBooking.service}`, "LOCATION:Via di Centocelle 530\\, Roma",
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Promemoria appuntamento", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
  a.download = "fresh-cut-lab.ics"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});

// my bookings (this device)
function renderMine() {
  const now = dateKey(new Date());
  const list = store.get().filter((b) => b.date >= now).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  store.set(list);
  $("#mine").hidden = !list.length;
  $("#mineList").innerHTML = "";
  list.forEach((b) => {
    const li = document.createElement("li");
    li.innerHTML = `<span><b>${b.time}</b> · ${longDate(fromKey(b.date))} — ${b.service}</span>`;
    const btn = document.createElement("button"); btn.textContent = "Annulla";
    btn.addEventListener("click", () => {
      window.open(waUrl(`Ciao! Devo annullare la prenotazione di ${longDate(fromKey(b.date))} alle ${b.time} (${b.service}) a nome ${b.name}.`), "_blank", "noopener");
      store.set(store.get().filter((x) => x.id !== b.id)); renderMine();
    });
    li.append(btn); $("#mineList").append(li);
  });
}
renderMine();
