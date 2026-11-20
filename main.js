(() => {
  "use strict";

  /* ---------- Настройки ---------- */
  const TELEGRAM = "https://t.me/bxr1ss";
  const DEFAULT_MESSAGE = "Здравствуйте, Борис! Хочу записаться на консультацию по маркетингу.";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const TAU = Math.PI * 2;
  const INK = [10, 10, 10];
  const ACCENT = [255, 77, 23];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rad = (deg) => (deg * Math.PI) / 180;
  const tgUrl = (message) => `${TELEGRAM}?text=${encodeURIComponent(message)}`;
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a.toFixed(3)})`;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // Детерминированный генератор, чтобы сцены выглядели одинаково при каждой загрузке
  const makeRandom = (seed) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const rotX = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  };
  const rotY = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  };
  const rotZ = (p, a) => {
    const c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  };

  /* ---------- Холст и цикл отрисовки ---------- */
  function setupCanvas(canvas, onResize) {
    const state = { ctx: canvas.getContext("2d"), w: 0, h: 0 };
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (!w || !h) return;
      state.w = w;
      state.h = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      state.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    // Первый замер синхронный, дальше следим за изменением размера
    new ResizeObserver(() => {
      fit();
      if (onResize) onResize();
    }).observe(canvas);
    fit();
    return state;
  }

  // Рисуем только пока элемент на экране и вкладка активна
  function runLoop(el, frame) {
    let visible = false;
    let raf = 0;
    let last = 0;
    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      frame(now / 1000, dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (reduced) {
        if (visible) frame(2, 0);
        return;
      }
      if (!raf && visible && !document.hidden) {
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };
    new IntersectionObserver(
      (entries) => {
        visible = entries[0].isIntersecting;
        start();
      },
      { rootMargin: "120px" }
    ).observe(el);
    document.addEventListener("visibilitychange", start);
  }

  /* ---------- Ссылки в Telegram ---------- */
  $$("[data-tg]").forEach((a) => {
    a.href = tgUrl(DEFAULT_MESSAGE);
  });

  const year = $("#year");
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- Мобильное меню ---------- */
  (function initMenu() {
    const burger = $(".burger");
    const menu = $("#menu");
    if (!burger || !menu) return;
    let timer = 0;

    const setOpen = (open) => {
      clearTimeout(timer);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
      document.body.style.overflow = open ? "hidden" : "";
      if (open) {
        menu.hidden = false;
        void menu.offsetWidth;
        menu.classList.add("open");
      } else {
        menu.classList.remove("open");
        timer = setTimeout(() => (menu.hidden = true), 300);
      }
    };

    burger.addEventListener("click", () => setOpen(burger.getAttribute("aria-expanded") !== "true"));
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && burger.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        burger.focus();
      }
    });
    matchMedia("(min-width: 901px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  })();

  /* ---------- Появление блоков ---------- */
  (function initReveal() {
    const items = $$(".reveal, [data-inview]");
    if (!("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  })();

  /* ---------- Текущий раздел в навигации ---------- */
  (function initNavState() {
    const links = $$(".nav-links a");
    const map = new Map();
    links.forEach((a) => {
      const section = $(a.getAttribute("href"));
      if (section) map.set(section, a);
    });
    if (!map.size) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const link = map.get(entry.target);
          if (entry.isIntersecting) {
            links.forEach((a) => a.classList.toggle("is-current", a === link));
          } else {
            link.classList.remove("is-current");
          }
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );
    map.forEach((_, section) => io.observe(section));
  })();

  /* ---------- Первый экран: наклон фото и орбиты ---------- */
  (function initHero() {
    const hero = $(".hero");
    const stage = $("#stage");
    const tilt = $("#tilt");
    const backCanvas = $("#orbitBack");
    const frontCanvas = $("#orbitFront");
    if (!hero || !stage || !backCanvas || !frontCanvas) return;

    const back = setupCanvas(backCanvas, () => reduced && frame(2, 0));
    const front = setupCanvas(frontCanvas);
    const FOCAL = 3.4;
    const FRONT_SCALE = 1.045; // передний холст ближе к зрителю и чуть крупнее фото

    const rings = [
      {
        r: 0.6, tilt: rad(-18), roll: rad(-13), cy: 0.2, n: 84, speed: 0.26,
        sats: [{ a: 0.4, size: 9, kind: "accent" }, { a: 3.3, size: 4, kind: "ink" }],
      },
      {
        r: 0.74, tilt: rad(-12), roll: rad(15), cy: 0.02, n: 104, speed: -0.17,
        sats: [{ a: 1.3, size: 6, kind: "ring" }, { a: 4.4, size: 5, kind: "accent" }],
      },
    ];

    const random = makeRandom(7);
    const dust = Array.from({ length: 64 }, () => {
      const theta = random() * TAU;
      const phi = Math.acos(random() * 2 - 1);
      const r = 0.62 + random() * 0.3;
      return {
        p: [r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi) * 1.25, r * Math.sin(phi) * Math.sin(theta)],
        size: 0.8 + random() * 1.4,
      };
    });

    const pointer = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    if (finePointer) {
      hero.addEventListener("pointermove", (e) => {
        const rect = stage.getBoundingClientRect();
        pointer.x = clamp((e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth * 0.5), -1, 1);
        pointer.y = clamp((e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight * 0.5), -1, 1);
      });
      hero.addEventListener("pointerleave", () => {
        pointer.x = 0;
        pointer.y = 0;
      });
    }

    function frame(t, dt) {
      // Наклон сцены: курсор плюс лёгкое покачивание, чтобы 3D было видно и на телефоне
      if (!reduced) {
        const goalX = pointer.x + Math.sin(t * 0.55) * 0.22;
        const goalY = pointer.y + Math.cos(t * 0.42) * 0.16;
        const k = 1 - Math.exp(-dt * 5);
        current.x += (goalX - current.x) * k;
        current.y += (goalY - current.y) * k;
        tilt.style.setProperty("--ry", `${(current.x * 13).toFixed(2)}deg`);
        tilt.style.setProperty("--rx", `${(-current.y * 9).toFixed(2)}deg`);
      }

      const unit = stage.offsetWidth;
      const w = back.w;
      const h = back.h;
      const cx = w / 2;
      const cy = h / 2;
      const halfW = stage.offsetWidth / 2 / FRONT_SCALE;
      const halfH = stage.offsetHeight / 2 / FRONT_SCALE;
      back.ctx.clearRect(0, 0, w, h);
      front.ctx.clearRect(0, 0, w, h);

      const place = (p) => {
        const k = FOCAL / (FOCAL - p[2]);
        const x = cx + p[0] * unit * k;
        const y = cy + p[1] * unit * k;
        const isFront = p[2] > 0;
        const overPhoto = isFront && Math.abs(x - cx) < halfW && Math.abs(y - cy) < halfH;
        return { x, y, k, isFront, overPhoto, ctx: isFront ? front.ctx : back.ctx };
      };

      // Пыль: видна только позади фото
      const dustSpin = t * 0.05;
      for (const d of dust) {
        const p = rotX(rotY(d.p, dustSpin), 0.2);
        if (p[2] > 0.05) continue;
        const q = place(p);
        q.ctx.fillStyle = rgba(INK, clamp(-p[2] * 0.5 + 0.06, 0, 0.3));
        q.ctx.beginPath();
        q.ctx.arc(q.x, q.y, d.size * q.k, 0, TAU);
        q.ctx.fill();
      }

      for (const ring of rings) {
        const spin = t * ring.speed;
        const point = (a) => {
          let p = [ring.r * Math.cos(a), 0, ring.r * Math.sin(a)];
          p = rotZ(rotX(p, ring.tilt), ring.roll);
          p[1] += ring.cy;
          return p;
        };

        for (let i = 0; i < ring.n; i++) {
          const p = point((i / ring.n) * TAU + spin);
          const q = place(p);
          const depth = clamp((p[2] / ring.r) * 0.5 + 0.5);
          const color = q.overPhoto ? [255, 255, 255] : INK;
          q.ctx.fillStyle = rgba(color, 0.18 + 0.62 * depth);
          q.ctx.beginPath();
          q.ctx.arc(q.x, q.y, (0.8 + 1.1 * depth) * q.k, 0, TAU);
          q.ctx.fill();
        }

        for (const sat of ring.sats) {
          const p = point(sat.a + spin * 2.2);
          const q = place(p);
          const size = sat.size * q.k;
          const base = q.overPhoto ? [255, 255, 255] : INK;
          q.ctx.beginPath();
          q.ctx.arc(q.x, q.y, size, 0, TAU);
          if (sat.kind === "ring") {
            q.ctx.lineWidth = 2;
            q.ctx.strokeStyle = rgba(base, 1);
            q.ctx.stroke();
          } else {
            q.ctx.fillStyle = sat.kind === "accent" ? rgba(ACCENT, 1) : rgba(base, 1);
            q.ctx.fill();
            if (sat.kind === "accent") {
              q.ctx.lineWidth = 2;
              q.ctx.strokeStyle = "#ffffff";
              q.ctx.stroke();
            }
          }
        }
      }
    }

    runLoop(stage, frame);
  })();

  /* ---------- 3D наклон карточек ---------- */
  if (finePointer && !reduced) {
    $$("[data-tilt]").forEach((el) => {
      const max = parseFloat(el.dataset.tiltMax || "7");
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width - 0.5;
        const py = (e.clientY - rect.top) / rect.height - 0.5;
        el.style.setProperty("--ry", `${(px * max * 2).toFixed(2)}deg`);
        el.style.setProperty("--rx", `${(-py * max * 2).toFixed(2)}deg`);
        el.classList.add("is-tilting");
      });
      el.addEventListener("pointerleave", () => {
        el.classList.remove("is-tilting");
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
      });
    });

    // Кнопка слегка тянется за курсором
    $$("[data-magnetic]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2);
        const dy = e.clientY - (rect.top + rect.height / 2);
        el.style.transform = `translate(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ---------- Главная мысль: слова загораются по одному ---------- */
  (function initTagline() {
    const el = $("#tagline");
    if (!el) return;
    // Оборачиваем каждое слово, переносы строк в разметке оставляем как есть
    const spans = [];
    Array.from(el.childNodes).forEach((node) => {
      if (node.nodeType !== Node.TEXT_NODE) return;
      const fragment = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) {
          fragment.append(" ");
          return;
        }
        const span = document.createElement("span");
        span.className = "w";
        span.textContent = part;
        spans.push(span);
        fragment.append(span);
      });
      node.replaceWith(fragment);
    });

    if (reduced) {
      spans.forEach((s) => s.classList.add("on"));
      return;
    }

    let shown = 0;
    let queued = false;
    const update = () => {
      queued = false;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const progress = clamp((vh * 0.85 - rect.top) / (vh * 0.4 + rect.height / 2));
      const count = Math.round(progress * spans.length);
      if (count <= shown) return;
      for (let i = shown; i < count; i++) spans[i].classList.add("on");
      shown = count;
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(update);
    };

    new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          window.addEventListener("scroll", onScroll, { passive: true });
          onScroll();
        } else {
          window.removeEventListener("scroll", onScroll);
        }
      },
      { rootMargin: "20% 0px" }
    ).observe(el);
  })();

  /* ---------- 3D воронка ---------- */
  (function initFunnel() {
    const canvas = $("#funnel");
    const items = $$("#serviceList .service");
    if (!canvas) return;

    const LEVELS = 4;
    const GAP = 0.03;
    const HEIGHT = 1.08;
    const FOCAL = 5.2;
    const COS = Math.cos(-0.4);
    const SIN = Math.sin(-0.4);
    const labels = ["Охват", "Интерес", "Заявки", "Оплаты"];
    const radiusAt = (u) => 0.2 + 0.8 * Math.pow(1 - u, 1.3);
    const heightAt = (u) => (u - 0.5) * 2 * HEIGHT;

    const dots = [];
    for (let level = 0; level < LEVELS; level++) {
      const from = level / LEVELS + GAP;
      const to = (level + 1) / LEVELS - GAP;
      const rows = 6;
      for (let j = 0; j < rows; j++) {
        const u = from + ((to - from) * j) / (rows - 1);
        const n = Math.round(18 + 58 * radiusAt(u));
        for (let i = 0; i < n; i++) dots.push({ u, a: (i / n) * TAU + j * 0.21, level });
      }
    }

    const random = makeRandom(21);
    const spawn = (p, initial) => {
      const roll = random();
      p.limit = roll < 0.4 ? 1 : roll < 0.7 ? 2 : roll < 0.88 ? 3 : 5;
      p.end = p.limit < 5 ? p.limit / LEVELS - GAP : 1.2;
      p.u = initial ? random() * p.end : 0;
      p.a = random() * TAU;
      p.w = 0.5 + random() * 0.8;
      p.v = 0.08 + random() * 0.07;
      p.rho = 0.15 + Math.sqrt(random()) * 0.7;
      return p;
    };
    const particles = Array.from({ length: 70 }, () => spawn({}, true));

    const glow = [1, 0, 0, 0];
    const spin = [0, 0, 0, 0];
    let active = 0;

    const setActive = (index) => {
      active = index;
      items.forEach((item, i) => item.classList.toggle("is-active", i === index));
      if (reduced) frame(2, 0);
    };

    const state = setupCanvas(canvas, () => reduced && frame(2, 0));

    function frame(t, dt) {
      const { ctx, w, h } = state;
      if (!w) return;
      const scale = Math.min(w * 0.33, h * 0.33);
      const cx = w * 0.4;
      const cy = h * 0.5 + scale * 0.06;
      ctx.clearRect(0, 0, w, h);

      const project = (x, y, z) => {
        const y2 = y * COS - z * SIN;
        const z2 = y * SIN + z * COS;
        const k = FOCAL / (FOCAL - z2);
        return [cx + x * scale * k, cy + y2 * scale * k, k];
      };

      for (let i = 0; i < LEVELS; i++) {
        glow[i] = reduced ? (i === active ? 1 : 0) : lerp(glow[i], i === active ? 1 : 0, 1 - Math.exp(-dt * 6));
        spin[i] += dt * (i % 2 ? -0.22 : 0.16) * (1 + glow[i] * 0.8);
      }
      const colors = glow.map((g) => mix(INK, ACCENT, g));

      const drawDots = (frontHalf) => {
        let level = -1;
        for (const d of dots) {
          const a = d.a + spin[d.level];
          const sin = Math.sin(a);
          if (sin > 0 !== frontHalf) continue;
          if (d.level !== level) {
            level = d.level;
            ctx.fillStyle = rgba(colors[level], 1);
          }
          const r = radiusAt(d.u);
          const depth = sin * 0.5 + 0.5;
          const g = glow[level];
          const [x, y, k] = project(r * Math.cos(a), heightAt(d.u), r * sin);
          ctx.globalAlpha = lerp(0.14 + 0.4 * depth, 0.5 + 0.5 * depth, g);
          ctx.beginPath();
          ctx.arc(x, y, (0.9 + 0.7 * depth + 0.5 * g) * k, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      };

      drawDots(false);

      // Частицы: люди, которые проходят по воронке. До оплаты доходят немногие
      for (const p of particles) {
        p.u += p.v * dt;
        if (p.u > p.end) spawn(p, false);
        const r = radiusAt(clamp(p.u)) * p.rho;
        p.a += (p.w * dt) / (0.3 + r);
        const [x, y, k] = project(r * Math.cos(p.a), heightAt(p.u), r * Math.sin(p.a));
        const survivor = p.limit === 5 && p.u > 0.76;
        const fade = clamp(p.u / 0.05) * clamp((p.end - p.u) / 0.06);
        ctx.globalAlpha = fade * (survivor ? 1 : 0.75);
        ctx.fillStyle = survivor ? rgba(ACCENT, 1) : rgba(INK, 1);
        ctx.beginPath();
        ctx.arc(x, y, (survivor ? 3 : 1.8) * k, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      drawDots(true);

      // Подписи уровней
      const labelX = cx + scale * 1.2;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      for (let i = 0; i < LEVELS; i++) {
        const u = (i + 0.5) / LEVELS;
        const [x, y] = project(radiusAt(u), heightAt(u), 0);
        const g = glow[i];
        ctx.strokeStyle = rgba(mix([200, 200, 196], INK, g), 1);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 10, y);
        ctx.lineTo(labelX - 10, y);
        ctx.stroke();
        ctx.fillStyle = rgba(mix([154, 154, 154], INK, g), 1);
        ctx.font = `${g > 0.5 ? 700 : 600} 14px Manrope, system-ui, sans-serif`;
        ctx.fillText(labels[i], labelX, y);
      }
    }

    runLoop(canvas, frame);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => reduced && frame(2, 0));

    // На десктопе уровень переключается прокруткой списка, на телефоне по таймеру
    const desktop = matchMedia("(min-width: 901px)");
    const io = new IntersectionObserver(
      (entries) => {
        if (!desktop.matches) return;
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(items.indexOf(entry.target));
        });
      },
      { rootMargin: "-42% 0px -48% 0px" }
    );
    items.forEach((item, i) => {
      io.observe(item);
      item.addEventListener("pointerenter", () => desktop.matches && finePointer && setActive(i));
    });

    let inView = false;
    new IntersectionObserver((entries) => (inView = entries[0].isIntersecting)).observe(canvas);
    setInterval(() => {
      if (!desktop.matches && inView && !reduced && !document.hidden) setActive((active + 1) % LEVELS);
    }, 2600);
  })();

  /* ---------- 3D бумажный самолётик ---------- */
  (function initPlane() {
    const canvas = $("#plane");
    const card = $(".final");
    if (!canvas || !card) return;

    const V = {
      nose: [1.35, 0, 0],
      left: [-1, -0.1, -1],
      right: [-1, -0.1, 1],
      foldL: [-1, -0.1, -0.16],
      foldR: [-1, -0.1, 0.16],
      keel: [-1, 0.5, 0],
    };
    const faces = [
      { pts: [V.nose, V.foldL, V.left], wing: true },
      { pts: [V.nose, V.right, V.foldR], wing: true },
      { pts: [V.nose, V.keel, V.foldL], wing: false },
      { pts: [V.nose, V.foldR, V.keel], wing: false },
    ];
    const light = (() => {
      const l = [-0.35, -0.8, 0.5];
      const len = Math.hypot(...l);
      return l.map((v) => v / len);
    })();
    const trails = [
      { y: -0.1, z: -0.85 },
      { y: -0.1, z: 0.85 },
      { y: 0.35, z: 0 },
    ];
    const FOCAL = 6;
    const VIEW = -0.55;

    const pointer = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    if (finePointer) {
      card.addEventListener("pointermove", (e) => {
        const rect = card.getBoundingClientRect();
        pointer.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        pointer.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      });
      card.addEventListener("pointerleave", () => {
        pointer.x = 0;
        pointer.y = 0;
      });
    }

    const state = setupCanvas(canvas, () => reduced && frame(2, 0));

    function frame(t, dt) {
      const { ctx, w, h } = state;
      if (!w) return;
      const k = reduced ? 1 : 1 - Math.exp(-dt * 4);
      current.x += (pointer.x - current.x) * k;
      current.y += (pointer.y - current.y) * k;

      const bank = Math.sin(t * 0.8) * 0.5 + current.x * 0.4;
      const pitch = -0.26 + Math.sin(t * 0.7) * 0.08 - current.y * 0.2;
      const yaw = 0.4 + Math.sin(t * 0.45) * 0.25 + current.x * 0.45;
      const bob = Math.sin(t * 1.1) * 0.08;
      const scale = Math.min(w * 0.24, h * 0.4);
      const cx = w * 0.52;
      const cy = h * 0.56;

      // Камера смотрит немного сверху, чтобы были видны крылья
      const transform = (p) => {
        const q = rotX(rotY(rotZ(rotX(p, bank), pitch), yaw), VIEW);
        q[1] += bob;
        return q;
      };
      const project = (p) => {
        const s = FOCAL / (FOCAL - p[2]);
        return [cx + p[0] * scale * s, cy + p[1] * scale * s, s];
      };

      ctx.clearRect(0, 0, w, h);

      // Шлейф
      for (const trail of trails) {
        for (let j = 0; j < 12; j++) {
          const dist = (j * 0.3 + t * 1.5) % 3.6;
          const p = transform([-1.15 - dist, trail.y + Math.sin(dist * 2.4 + t * 2) * 0.04, trail.z * (1 + dist * 0.12)]);
          const [x, y, s] = project(p);
          ctx.fillStyle = rgba([255, 255, 255], 0.5 * (1 - dist / 3.6));
          ctx.beginPath();
          ctx.arc(x, y, 1.6 * s, 0, TAU);
          ctx.fill();
        }
      }

      // Грани: сортируем от дальних к ближним
      const drawn = faces.map((face) => {
        const pts = face.pts.map(transform);
        const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]];
        const e2 = [pts[2][0] - pts[0][0], pts[2][1] - pts[0][1], pts[2][2] - pts[0][2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const len = Math.hypot(...n) || 1;
        const nz = n[2] / len;
        const lambert = Math.abs((n[0] * light[0] + n[1] * light[1] + n[2] * light[2]) / len);
        const z = (pts[0][2] + pts[1][2] + pts[2][2]) / 3;
        let color;
        if (!face.wing) {
          const v = 120 + 90 * lambert;
          color = [v, v, v];
        } else if (nz > 0) {
          const v = 190 + 65 * lambert;
          color = [v, v, v];
        } else {
          const v = 0.72 + 0.28 * lambert;
          color = [ACCENT[0] * v, ACCENT[1] * v, ACCENT[2] * v];
        }
        return { pts, z, color };
      });
      drawn.sort((a, b) => a.z - b.z);

      for (const face of drawn) {
        ctx.fillStyle = rgba(face.color, 1);
        ctx.strokeStyle = ctx.fillStyle;
        ctx.lineWidth = 1;
        ctx.lineJoin = "round";
        ctx.beginPath();
        face.pts.forEach((p, i) => {
          const [x, y] = project(p);
          if (i) ctx.lineTo(x, y);
          else ctx.moveTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }

    runLoop(canvas, frame);
  })();

  /* ---------- Форма заявки ---------- */
  (function initForm() {
    const form = $("#leadForm");
    const success = $("#success");
    const successLink = $("#successLink");
    const back = $("#successBack");
    if (!form || !success) return;

    const business = form.elements.business;
    const field = business.closest(".field");

    const validate = () => {
      const ok = business.value.trim().length >= 2;
      field.classList.toggle("invalid", !ok);
      business.setAttribute("aria-invalid", String(!ok));
      return ok;
    };
    business.addEventListener("input", () => {
      if (field.classList.contains("invalid")) validate();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate()) {
        business.focus();
        return;
      }
      const goal = form.elements.goal.value.trim();
      const lines = [
        "Здравствуйте, Борис! Хочу записаться на консультацию по маркетингу.",
        "",
        `Бизнес: ${business.value.trim()}`,
      ];
      if (goal) lines.push(`Задача: ${goal}`);
      const url = tgUrl(lines.join("\n"));

      successLink.href = url;
      window.open(url, "_blank", "noopener");
      // Если браузер заблокирует новую вкладку, чат откроется по кнопке в блоке успеха
      form.hidden = true;
      success.hidden = false;
      success.focus({ preventScroll: true });
    });

    back.addEventListener("click", () => {
      success.hidden = true;
      form.hidden = false;
      business.focus();
    });
  })();

  /* ---------- Нижняя кнопка на телефоне ---------- */
  (function initStickyCta() {
    const sticky = $("#stickyCta");
    const heroCta = $("#heroCta");
    const contact = $("#contact");
    if (!sticky || !heroCta || !contact) return;
    let heroVisible = true;
    let contactVisible = false;
    const sync = () => sticky.classList.toggle("show", !heroVisible && !contactVisible);
    new IntersectionObserver((entries) => {
      heroVisible = entries[0].isIntersecting;
      sync();
    }).observe(heroCta);
    new IntersectionObserver((entries) => {
      contactVisible = entries[0].isIntersecting;
      sync();
    }).observe(contact);
  })();
})();
