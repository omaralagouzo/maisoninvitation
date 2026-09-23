/* Maison — live invitation behaviour: envelope, countdown, Hijri date, calendar,
   RSVP (Shopify form · Google Sheet · WhatsApp), music, share, reveal. */
(() => {
  const root = document.querySelector('[data-invitation]');
  if (!root) return;

  const html = document.documentElement;
  const lang = root.dataset.lang || 'en';
  const isAr = lang === 'ar';
  const isDemo = root.dataset.demo === 'true';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const numberLocale = isAr ? 'ar-EG' : 'en-US';
  const fmt = (n, pad = 1) => Number(n).toLocaleString(numberLocale, { minimumIntegerDigits: pad, useGrouping: false });

  // Event start as local "floating" time (never shifts between time zones).
  const [datePart, timePart = '19:00'] = (root.dataset.date || '').split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [hh, mm] = timePart.split(':').map(Number);
  const eventDate = new Date(y, (mo || 1) - 1, d || 1, hh || 0, mm || 0);

  /* ---------------------------------------------------------------- envelope */
  const envelope = root.querySelector('[data-envelope]');
  const music = root.querySelector('[data-music]');
  const musicToggle = root.querySelector('[data-music-toggle]');
  const skipEnvelope = !envelope || html.classList.contains('inv-embed') || html.classList.contains('inv-skip-envelope');

  const heroItems = [...root.querySelectorAll('.inv-hero [data-inv-reveal]')];
  heroItems.forEach((el, i) => el.style.setProperty('--i', i));

  const finishOpen = () => {
    root.classList.add('is-open');
    html.classList.remove('inv-locked');
    heroItems.forEach((el) => el.classList.remove('inv-hold'));
  };

  if (skipEnvelope) {
    finishOpen();
  } else {
    html.classList.add('inv-locked');
    heroItems.forEach((el) => el.classList.add('inv-hold'));
    const opener = envelope.querySelector('[data-envelope-open]');
    let opened = false;
    const open = () => {
      if (opened) return;
      opened = true;
      root.classList.add('is-opening');
      playMusic();
      setTimeout(finishOpen, reduceMotion ? 0 : 1650);
      setTimeout(() => envelope.setAttribute('hidden', ''), reduceMotion ? 0 : 2600);
    };
    opener.addEventListener('click', open);
    opener.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
  }

  /* ---------------------------------------------------------------- music */
  function playMusic() {
    if (!music) return;
    music.volume = 0.6;
    music.play().then(() => musicToggle?.setAttribute('aria-pressed', 'true')).catch(() => {});
  }
  musicToggle?.addEventListener('click', () => {
    if (music.paused) playMusic();
    else {
      music.pause();
      musicToggle.setAttribute('aria-pressed', 'false');
    }
  });

  /* ---------------------------------------------------------------- hijri */
  const hijriTarget = root.querySelector('[data-hijri-target]');
  if (hijriTarget && root.dataset.hijri === 'true') {
    try {
      hijriTarget.textContent =
        'الموافق ' +
        new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', { day: 'numeric', month: 'long', year: 'numeric' }).format(eventDate);
    } catch (_) {
      hijriTarget.remove();
    }
  }

  /* ---------------------------------------------------------------- countdown */
  const countdown = root.querySelector('[data-countdown]');
  if (countdown) {
    const cells = {};
    countdown.querySelectorAll('[data-cd]').forEach((el) => (cells[el.dataset.cd] = el));
    const grid = countdown.querySelector('[data-countdown-grid]');
    const done = countdown.querySelector('[data-countdown-done]');
    const tick = () => {
      const diff = eventDate - new Date();
      if (diff <= 0) {
        grid.hidden = true;
        done.hidden = false;
        done.textContent = diff > -24 * 3600e3 ? done.dataset.today : done.dataset.married;
        return false;
      }
      const s = Math.floor(diff / 1000);
      cells.days.textContent = fmt(Math.floor(s / 86400));
      cells.hours.textContent = fmt(Math.floor((s % 86400) / 3600), 2);
      cells.minutes.textContent = fmt(Math.floor((s % 3600) / 60), 2);
      cells.seconds.textContent = fmt(s % 60, 2);
      return true;
    };
    if (tick()) {
      const timer = setInterval(() => tick() || clearInterval(timer), 1000);
    }
  }

  /* ---------------------------------------------------------------- calendar */
  const calendar = root.querySelector('[data-calendar]');
  if (calendar) {
    const toggle = calendar.querySelector('[data-calendar-toggle]');
    const menu = calendar.querySelector('[data-calendar-menu]');
    const title = root.dataset.title || document.title;
    const location = root.dataset.venue || '';
    const end = new Date(eventDate.getTime() + 5 * 3600e3);
    const stamp = (dt) =>
      `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`;
    const google = calendar.querySelector('[data-calendar-google]');
    google.href =
      'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      `&text=${encodeURIComponent(title)}&dates=${stamp(eventDate)}/${stamp(end)}` +
      `&details=${encodeURIComponent(window.location.href.split('?')[0])}&location=${encodeURIComponent(location)}`;
    calendar.querySelector('[data-calendar-ics]').addEventListener('click', () => {
      const esc = (s) => s.replace(/[\\,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Maison Invitation//EN',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@maisoninvitation`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART:${stamp(eventDate)}`,
        `DTEND:${stamp(end)}`,
        `SUMMARY:${esc(title)}`,
        `LOCATION:${esc(location)}`,
        `URL:${window.location.href.split('?')[0]}`,
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      a.download = 'invitation.ics';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    const setOpen = (open) => {
      menu.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      setOpen(menu.hidden);
    });
    document.addEventListener('click', (e) => !calendar.contains(e.target) && setOpen(false));
    document.addEventListener('keydown', (e) => e.key === 'Escape' && setOpen(false));
  }

  /* ---------------------------------------------------------------- rsvp */
  const status = root.querySelector('[data-rsvp-status]');
  const showStatus = (text) => {
    if (!status) return;
    status.textContent = text;
    status.hidden = false;
  };
  root.querySelectorAll('.inv-rsvp__form').forEach((form) => {
    const mode = form.dataset.rsvp || 'form';
    const guestsField = form.querySelector('[data-guests-field]');
    form.querySelectorAll('[data-attending]').forEach((radio) =>
      radio.addEventListener('change', () => {
        if (guestsField) guestsField.hidden = radio.dataset.attending === 'no' && radio.checked;
      }),
    );
    form.addEventListener('submit', async (event) => {
      const attending = form.querySelector('[data-attending]:checked')?.dataset.attending !== 'no';
      const thanks = attending ? status?.dataset.thanks : status?.dataset.thanksDecline;
      if (isDemo) {
        event.preventDefault();
        form.hidden = true;
        showStatus(`${thanks} ${status?.dataset.demo || ''}`);
        return;
      }
      if (mode === 'whatsapp') {
        event.preventDefault();
        const name = form.querySelector('[name="contact[name]"]')?.value || '';
        const count = form.querySelector('[name="contact[Guests]"]')?.value || '1';
        const answer = attending ? status.dataset.accept : status.dataset.decline;
        const message = (form.dataset.message || '')
          .replace('%names%', root.dataset.names || '')
          .replace('%guest%', name)
          .replace('%answer%', answer)
          .replace('%count%', attending ? count : '0');
        window.open(`https://wa.me/${form.dataset.whatsapp}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
        return;
      }
      if (mode === 'sheet') {
        event.preventDefault();
        const button = form.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
          // url-encoded (not multipart) so Google Apps Script receives the fields in e.parameter
          await fetch(form.action, { method: 'POST', mode: 'no-cors', body: new URLSearchParams(new FormData(form)) });
          form.hidden = true;
          showStatus(thanks);
        } catch (_) {
          showStatus(status.dataset.error);
          button.disabled = false;
        }
      }
      // mode "form": Shopify's contact form posts normally and returns to this page.
    });
  });

  /* ---------------------------------------------------------------- share */
  root.querySelector('[data-inv-share]')?.addEventListener('click', async () => {
    const url = window.location.href.split('?')[0];
    try {
      if (navigator.share) await navigator.share({ title: root.dataset.title, url });
      else {
        await navigator.clipboard.writeText(url);
        const b = root.querySelector('[data-inv-share]');
        const original = b.innerHTML;
        b.textContent = isAr ? 'تم نسخ الرابط' : 'Link copied';
        setTimeout(() => (b.innerHTML = original), 2000);
      }
    } catch (_) {
      /* cancelled */
    }
  });

  /* ---------------------------------------------------------------- reveal */
  const targets = [...root.querySelectorAll('[data-inv-reveal]')].filter((el) => !el.closest('.inv-hero'));
  if (!reduceMotion && 'IntersectionObserver' in window && !html.classList.contains('inv-embed')) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove('inv-pending');
          io.unobserve(entry.target);
        }),
      { rootMargin: '0px 0px -8% 0px' },
    );
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) return;
      el.classList.add('inv-pending');
      io.observe(el);
    });
  }
})();
