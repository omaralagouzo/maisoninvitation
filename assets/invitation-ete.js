/* Maison — Été design behaviour: swaying cut-out trees, live day countdown, scratch-to-reveal
   venue, scroll-driven fan and RSVP companions. The envelope timing, RSVP sending, share and
   reveal-on-scroll come from invitation.js, which loads first. */
(() => {
  const root = document.querySelector('.inv--ete[data-invitation]');
  if (!root) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const isAr = root.dataset.lang === 'ar';
  const fmt = (n) => Number(n).toLocaleString(isAr ? 'ar-EG' : 'en-US', { useGrouping: false });
  const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
  const onReduceMotionChange = (fn) =>
    reduceMotion.addEventListener ? reduceMotion.addEventListener('change', fn) : reduceMotion.addListener(fn);

  /* ---------------------------------------------------------------- trees
     Paper cut-out style: each tree pivots at its trunk and holds a pose for a tenth of a second,
     like stop-motion, instead of gliding smoothly. */
  const garden = root.querySelector('[data-ete-garden]');
  const trees = garden ? [...garden.querySelectorAll('[data-sway]')] : [];
  if (trees.length) {
    const POSES_PER_SECOND = 10;
    const sway = trees.map((el, i) => ({
      el,
      amp: 1.9 + ((i * 7) % 5) * 0.32,
      period: 3.2 + ((i * 3) % 4) * 0.5,
      phase: (i * 1.9) % (Math.PI * 2),
    }));
    let raf = 0;
    let last = 0;
    let visible = false;
    const pose = (now) => {
      raf = requestAnimationFrame(pose);
      if (now - last < 1000 / POSES_PER_SECOND) return;
      last = now;
      const t = now / 1000;
      const gust = 0.6 * Math.sin((2 * Math.PI * t) / 9.5);
      for (const s of sway) {
        const angle = s.amp * Math.sin((2 * Math.PI * t) / s.period + s.phase) + gust;
        s.el.style.setProperty('--r', `${angle.toFixed(2)}deg`);
      }
    };
    const start = () => {
      if (!raf && visible && !document.hidden && !reduceMotion.matches) raf = requestAnimationFrame(pose);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) start();
        else stop();
      }).observe(garden);
    } else {
      visible = true;
      start();
    }
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    onReduceMotionChange(() => {
      if (!reduceMotion.matches) return start();
      stop();
      trees.forEach((el) => el.style.removeProperty('--r'));
    });
  }

  /* ---------------------------------------------------------------- countdown (days) */
  const countdown = root.querySelector('[data-ete-countdown]');
  if (countdown) {
    const num = countdown.querySelector('[data-ete-days]');
    const numLine = num.parentElement;
    const label = countdown.querySelector('[data-ete-days-label]');
    const [y, m, d] = (root.dataset.date || '').split('T')[0].split('-').map(Number);
    // Whole calendar days between today (the guest's date) and the wedding date.
    const daysLeft = () => {
      const now = new Date();
      return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 864e5);
    };
    let counted = false;
    const update = (animate = false) => {
      const n = daysLeft();
      numLine.hidden = n <= 0;
      if (n > 1) label.textContent = countdown.dataset.many;
      else if (n === 1) label.textContent = countdown.dataset.one;
      else label.textContent = n === 0 ? countdown.dataset.today : countdown.dataset.married;
      if (n <= 0) return;
      if (!animate || reduceMotion.matches) {
        num.textContent = fmt(n);
        return;
      }
      // Count up once, the first time the numbers come into view.
      const t0 = performance.now();
      const run = (now) => {
        const k = clamp((now - t0) / 1600);
        num.textContent = fmt(Math.round(n * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    };
    update();
    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      const io = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting || counted) return;
        counted = true;
        io.disconnect();
        update(true);
      }, { threshold: 0.4 });
      io.observe(countdown);
    }
    setInterval(() => update(), 60 * 1000); // rolls over at midnight
  }

  /* ---------------------------------------------------------------- scratch to reveal */
  const scratch = root.querySelector('[data-ete-scratch]');
  if (scratch) {
    const canvas = scratch.querySelector('[data-ete-scratch-canvas]');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const revealButton = scratch.querySelector('[data-ete-scratch-reveal]');
    const strokes = []; // normalised points, replayed if the card is resized
    let w = 0;
    let h = 0;
    let dpr = 1;
    let texture = null;
    let revealed = false;
    let drawing = false;
    let lastPoint = null;
    let movesSinceCheck = 0;

    const brush = () => Math.max(16, Math.min(w, h) * 0.12);

    const reveal = () => {
      if (revealed) return;
      revealed = true;
      scratch.classList.add('is-revealed');
    };

    const cover = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || !texture) return;
      w = rect.width;
      h = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      const ir = texture.naturalWidth / texture.naturalHeight;
      const cr = w / h;
      let sw = texture.naturalWidth;
      let sh = texture.naturalHeight;
      if (ir > cr) sw = sh * cr;
      else sh = sw / cr;
      ctx.drawImage(texture, (texture.naturalWidth - sw) / 2, (texture.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const stroke of strokes) drawStroke(stroke.map(([x, yy]) => [x * w, yy * h]));
    };

    const drawStroke = (points) => {
      const r = brush();
      ctx.lineWidth = r * 2;
      ctx.beginPath();
      ctx.moveTo(points[0][0], points[0][1]);
      if (points.length === 1) ctx.lineTo(points[0][0] + 0.1, points[0][1]);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
      ctx.stroke();
    };

    // Share of the oval opening that has been scratched clear.
    const clearedShare = () => {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const step = Math.max(4, Math.round(6 * dpr));
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      let inside = 0;
      let clear = 0;
      for (let py = 0; py < canvas.height; py += step) {
        for (let px = 0; px < canvas.width; px += step) {
          const nx = (px - cx) / cx;
          const ny = (py - cy) / cy;
          if (nx * nx + ny * ny > 0.8) continue;
          inside++;
          if (data[(py * canvas.width + px) * 4 + 3] < 40) clear++;
        }
      }
      return inside ? clear / inside : 0;
    };

    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    canvas.addEventListener('pointerdown', (event) => {
      if (revealed || !texture) return;
      drawing = true;
      scratch.classList.add('is-touched');
      canvas.setPointerCapture?.(event.pointerId);
      lastPoint = point(event);
      strokes.push([[lastPoint[0] / w, lastPoint[1] / h]]);
      drawStroke([lastPoint]);
      event.preventDefault();
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!drawing) return;
      const p = point(event);
      drawStroke([lastPoint, p]);
      strokes[strokes.length - 1].push([p[0] / w, p[1] / h]);
      lastPoint = p;
      if (++movesSinceCheck > 24) {
        movesSinceCheck = 0;
        if (clearedShare() > 0.55) reveal();
      }
    });
    const end = () => {
      if (!drawing) return;
      drawing = false;
      if (clearedShare() > 0.45) reveal();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    revealButton?.addEventListener('click', reveal);

    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      texture = img;
      cover();
      scratch.classList.add('is-ready');
    };
    img.onerror = reveal;
    img.src = canvas.dataset.texture;
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => !revealed && cover(), 150);
    });
  }

  /* ---------------------------------------------------------------- fan
     Opens as the timeline scrolls into view, one frame per step of scroll. Until a real
     frame-by-frame animation is uploaded (theme setting "Été fan animation frames"), the
     frames are drawn from the still image: the leaf is cut into pleats that fold onto the
     top guard stick, the way a folding fan closes. */
  const fan = root.querySelector('[data-ete-fan]');
  if (fan) {
    const still = fan.querySelector('.ete-fan__img');
    const frameCount = Number(fan.dataset.frames || 0);
    const STEPS = frameCount || 48;
    let setFrame = () => {};

    if (frameCount > 0 && still && /ete-fan\.webp/.test(still.src)) {
      // Frame-by-frame: ete-fan-001.webp … ete-fan-NNN.webp, next to ete-fan.webp in the theme's assets.
      fan.classList.add('has-frames');
      const canvas = document.createElement('canvas');
      canvas.className = 'ete-fan__canvas';
      fan.appendChild(canvas);
      const ctx = canvas.getContext('2d');
      const frames = Array.from({ length: frameCount }, (_, i) => {
        const im = new Image();
        im.decoding = 'async';
        im.src = still.src.replace(/ete-fan\.webp/, `ete-fan-${String(i + 1).padStart(3, '0')}.webp`);
        return im;
      });
      let current = -1;
      const draw = (index) => {
        // Use the nearest frame that has finished loading.
        let i = index;
        while (i > 0 && !(frames[i].complete && frames[i].naturalWidth)) i--;
        const im = frames[i];
        if (!im.complete || !im.naturalWidth) return;
        const rect = fan.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.round(rect.width * dpr);
        const ch = Math.round(rect.height * dpr);
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        const scale = Math.min(cw / im.naturalWidth, ch / im.naturalHeight);
        const dw = im.naturalWidth * scale;
        const dh = im.naturalHeight * scale;
        ctx.clearRect(0, 0, cw, ch);
        ctx.drawImage(im, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      };
      frames.forEach((im, i) => (im.onload = () => i <= current && draw(current)));
      setFrame = (index) => {
        current = index;
        draw(index);
      };
    } else if (still) {
      // Built-in frames from the still image.
      const W = 960;
      const H = 1361;
      const PX = 0.7565 * W; // the rivet
      const PY = 0.5189 * H;
      const LEAF_TOP = 286; // leaf spans these angles (degrees clockwise from 3 o'clock)
      const LEAF_BOTTOM = 105;
      const PLEATS = 16;
      const STEP = (LEAF_TOP - LEAF_BOTTOM) / PLEATS;
      const R = 3 * W;
      const far = (deg) => {
        const a = (deg * Math.PI) / 180;
        return `${(((PX + R * Math.cos(a)) / W) * 100).toFixed(2)}% ${(((PY + R * Math.sin(a)) / H) * 100).toFixed(2)}%`;
      };
      const pivot = `${((PX / W) * 100).toFixed(2)}% ${((PY / H) * 100).toFixed(2)}%`;
      const piece = (clip, k = 0) => {
        const el = still.cloneNode();
        el.className = 'ete-fan__piece';
        el.style.clipPath = clip;
        el.style.setProperty('--k', k.toFixed(3));
        return el;
      };
      // Handle, rivet and tassel: everything outside the leaf stays put.
      const rest = [LEAF_TOP, 330, 0, 45, 90, LEAF_BOTTOM + 360].map(far).join(', ');
      const layers = [piece(`polygon(${pivot}, ${rest})`)];
      // Pleats from the bottom guard up, so each one tucks under the one above it.
      for (let i = PLEATS - 1; i >= 0; i--) {
        const upper = LEAF_TOP - i * STEP + (i ? 0.6 : 0);
        const lower = LEAF_TOP - (i + 1) * STEP;
        layers.push(piece(`polygon(${pivot}, ${far(upper)}, ${far((upper + lower) / 2)}, ${far(lower)})`, i * STEP));
      }
      // The round cap over the rivet hides where the pleats meet.
      layers.push(piece('circle(7.3% at 75.65% 51.89%)'));
      layers.forEach((el) => fan.appendChild(el));
      fan.classList.add('is-animated');
      setFrame = (index) => {
        const p = index / (STEPS - 1);
        fan.style.setProperty('--p', p.toFixed(4));
        fan.classList.toggle('is-open', index >= STEPS - 1);
      };
    }

    // Scroll → frame. Closed while the fan's middle is below the screen; open once it
    // reaches the middle of the screen. Scrolling back up closes it again.
    let lastIndex = -1;
    let ticking = false;
    const measure = () => {
      ticking = false;
      let p = 1;
      if (!reduceMotion.matches) {
        const rect = fan.getBoundingClientRect();
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const centre = rect.top + rect.height / 2;
        p = clamp((vh * 1.02 - centre) / (vh * 0.5));
      }
      const index = Math.round(p * (STEPS - 1));
      if (index !== lastIndex) {
        lastIndex = index;
        setFrame(index);
      }
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(measure);
      }
    };
    let active = false;
    const toggle = (on) => {
      if (on === active) return;
      active = on;
      if (on) {
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
      } else {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      }
      measure();
    };
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => toggle(entry.isIntersecting), { rootMargin: '25% 0px 25% 0px' }).observe(fan);
    } else {
      toggle(true);
    }
    measure();
    onReduceMotionChange(measure);
  }

  /* ---------------------------------------------------------------- RSVP companions */
  const form = root.querySelector('.ete-form');
  if (form) {
    const companions = form.querySelector('[data-ete-companions]');
    const list = companions?.querySelector('[data-ete-companion-list]');
    const max = Number(companions?.dataset.max || 0);
    const addButtons = companions ? [...companions.querySelectorAll('[data-ete-add]')] : [];
    const maxNote = companions?.querySelector('[data-ete-companions-max]');
    const guestCount = form.querySelector('[data-ete-guest-count]');
    const summary = form.querySelector('[data-ete-companions-summary]');
    const baseMessage = form.dataset.message;
    const value = (selector) => (form.querySelector(selector)?.value || '').trim();
    const attending = () => form.querySelector('[data-attending]:checked')?.dataset.attending !== 'no';

    const rows = () => (list ? [...list.children] : []);
    const sync = () => {
      const count = { adult: 0, child: 0 };
      const lines = rows().map((row) => {
        const kind = row.dataset.kind;
        const title = `${companions.dataset[kind]} ${fmt(++count[kind])}`;
        const name = row.querySelector('[data-field="name"]');
        const allergies = row.querySelector('[data-field="allergies"]');
        row.querySelector('.ete-companion__label').textContent = title;
        name.setAttribute('aria-label', `${title} · ${companions.dataset.name}`);
        allergies.setAttribute('aria-label', `${title} · ${companions.dataset.allergies}`);
        row.querySelector('.ete-companion__remove').setAttribute('aria-label', `${companions.dataset.remove} · ${title}`);
        const note = allergies.value.trim();
        return `${title}: ${name.value.trim() || '—'}${note ? ` (${note})` : ''}`;
      });
      const yes = attending();
      if (summary) summary.value = yes ? lines.join('\n') : '';
      if (guestCount) guestCount.value = String(yes ? 1 + lines.length : 0);
      const full = lines.length >= max;
      addButtons.forEach((b) => (b.disabled = full));
      if (maxNote) maxNote.hidden = !full;
      // WhatsApp replies carry the extra answers too.
      if (baseMessage !== undefined) {
        const extra = [
          yes && value('[name="contact[Dietary requirements]"]') && `${document.querySelector('label[for="EteRsvpDiet"]')?.textContent.trim()}: ${value('[name="contact[Dietary requirements]"]')}`,
          yes && lines.length && lines.join('\n'),
          value('[name="contact[Song request]"]') && `♫ ${value('[name="contact[Song request]"]')}`,
        ].filter(Boolean);
        form.dataset.message = [baseMessage, ...extra].join('\n');
      }
    };

    const addRow = (kind) => {
      if (!list || rows().length >= max) return;
      const row = document.createElement('li');
      row.className = 'ete-companion';
      row.dataset.kind = kind;
      const label = document.createElement('span');
      label.className = 'ete-companion__label';
      const input = (field, placeholder) => {
        const el = document.createElement('input');
        el.type = 'text';
        el.dataset.field = field;
        el.placeholder = placeholder;
        el.autocomplete = 'off';
        return el;
      };
      const name = input('name', companions.dataset.name);
      const allergies = input('allergies', companions.dataset.allergies);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'ete-companion__remove';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        sync();
        (next?.querySelector('input') || addButtons[0])?.focus();
      });
      row.append(label, name, allergies, remove);
      list.appendChild(row);
      sync();
      name.focus();
    };

    addButtons.forEach((b) => b.addEventListener('click', () => addRow(b.dataset.eteAdd)));
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    sync();
  }
})();
