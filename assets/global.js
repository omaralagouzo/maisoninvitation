/* Maison — global storefront behaviour. No dependencies. */
(() => {
  const Maison = (window.Maison = window.Maison || {});
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- toast */
  let toastTimer;
  Maison.toast = (message, ms = 3200) => {
    const el = document.querySelector('[data-toast]');
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), ms);
  };

  /* ---------------------------------------------------------------- header
     One dropdown at a time: opening any panel (Invitations, globe, mobile
     drawer) closes the others. Hover opens on devices that truly hover
     (desktop mouse); everything else — touch, keyboard — opens on click/tap. */
  class HeaderMenu extends HTMLElement {
    connectedCallback() {
      this.triggers = [...this.querySelectorAll('[data-dropdown-trigger]')];
      this.panels = {};
      this.querySelectorAll('[data-dropdown-panel]').forEach((p) => (this.panels[p.dataset.dropdownPanel] = p));
      this.scrim = this.querySelector('[data-dropdown-scrim]');
      this.current = null;
      this.canHover = window.matchMedia('(hover: hover) and (pointer: fine)');

      this.triggers.forEach((trigger) =>
        trigger.addEventListener('click', (event) => {
          event.preventDefault();
          this.toggle(trigger.dataset.dropdownTrigger, trigger);
        }),
      );

      this.querySelectorAll('[data-hover]').forEach((trigger) => {
        const name = trigger.dataset.dropdownTrigger;
        const panel = this.panels[name];
        if (!panel) return;
        const enter = () => {
          if (!this.canHover.matches) return;
          clearTimeout(this.leaveTimer);
          this.enterTimer = setTimeout(() => this.open(name, trigger), 80);
        };
        const leave = () => {
          if (!this.canHover.matches) return;
          clearTimeout(this.enterTimer);
          this.leaveTimer = setTimeout(() => this.current === name && this.close(), 240);
        };
        trigger.addEventListener('pointerenter', enter);
        trigger.addEventListener('pointerleave', leave);
        panel.addEventListener('pointerenter', () => clearTimeout(this.leaveTimer));
        panel.addEventListener('pointerleave', leave);
      });

      this.scrim?.addEventListener('click', () => this.close());
      document.addEventListener('click', (event) => {
        if (this.current && !this.contains(event.target)) this.close();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !this.current) return;
        const trigger = this.activeTrigger;
        this.close(true);
        trigger?.focus();
      });
      this.addEventListener('focusout', (event) => {
        if (this.current && event.relatedTarget && !this.contains(event.relatedTarget)) this.close();
      });

      const onScroll = () => this.classList.toggle('is-scrolled', window.scrollY > 8);
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();

      window.matchMedia('(min-width: 990px)').addEventListener('change', () => {
        if (this.current === 'drawer') this.close(true);
      });
    }

    toggle(name, trigger) {
      if (this.current === name) this.close();
      else this.open(name, trigger);
    }

    open(name, trigger) {
      if (this.current === name) return;
      if (this.current) this.close(true);
      const panel = this.panels[name];
      if (!panel) return;
      this.current = name;
      this.activeTrigger = trigger;
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-visible'));
      this.setExpanded(name, true);
      this.classList.add('is-open');
      if (name === 'drawer') document.documentElement.classList.add('drawer-open');
      if (name === 'invitations' && this.scrim) {
        this.scrim.hidden = false;
        requestAnimationFrame(() => this.scrim.classList.add('is-visible'));
      }
    }

    close(immediate = false) {
      const name = this.current;
      if (!name) return;
      const panel = this.panels[name];
      this.current = null;
      this.setExpanded(name, false);
      this.classList.remove('is-open');
      panel.classList.remove('is-visible');
      this.scrim?.classList.remove('is-visible');
      document.documentElement.classList.remove('drawer-open');
      const hide = () => {
        if (this.current !== name) panel.hidden = true;
        if (this.current !== 'invitations' && this.scrim) this.scrim.hidden = true;
      };
      if (immediate || reduceMotion.matches) hide();
      else setTimeout(hide, 280);
    }

    setExpanded(name, expanded) {
      this.triggers
        .filter((t) => t.dataset.dropdownTrigger === name)
        .forEach((t) => t.setAttribute('aria-expanded', String(expanded)));
    }
  }
  customElements.define('header-menu', HeaderMenu);

  /* ---------------------------------------------------------------- tabs
     Client-side, instant switching (no reload). Keyboard: arrows, Home, End. */
  class TabSwitcher extends HTMLElement {
    connectedCallback() {
      this.tabs = [...this.querySelectorAll('[role="tab"]')];
      this.list = this.querySelector('[role="tablist"]');
      this.indicator = this.querySelector('.tabs__indicator');
      this.tabs.forEach((tab) => {
        tab.addEventListener('click', () => this.select(tab));
        tab.addEventListener('keydown', (event) => this.onKey(event, tab));
      });
      this.list?.classList.add('is-ready');
      const selected = this.tabs.find((t) => t.getAttribute('aria-selected') === 'true') || this.tabs[0];
      this.moveIndicator(selected, false);
      if ('ResizeObserver' in window && this.list) {
        new ResizeObserver(() => this.moveIndicator(this.selected(), false)).observe(this.list);
      }
      document.fonts?.ready.then(() => this.moveIndicator(this.selected(), false));
    }

    selected() {
      return this.tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    }

    select(tab, focus = false) {
      this.tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      this.moveIndicator(tab, true);
      if (focus) tab.focus();
      this.dispatchEvent(new CustomEvent('tab:change', { detail: { tab }, bubbles: true }));
    }

    onKey(event, tab) {
      const rtl = document.documentElement.dir === 'rtl';
      const i = this.tabs.indexOf(tab);
      const nextKey = rtl ? 'ArrowLeft' : 'ArrowRight';
      const prevKey = rtl ? 'ArrowRight' : 'ArrowLeft';
      let target;
      if (event.key === nextKey) target = this.tabs[(i + 1) % this.tabs.length];
      else if (event.key === prevKey) target = this.tabs[(i - 1 + this.tabs.length) % this.tabs.length];
      else if (event.key === 'Home') target = this.tabs[0];
      else if (event.key === 'End') target = this.tabs[this.tabs.length - 1];
      if (!target) return;
      event.preventDefault();
      this.select(target, true);
    }

    moveIndicator(tab, animate) {
      if (!this.indicator || !tab || !this.list) return;
      const listRect = this.list.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      if (!animate) this.indicator.style.transition = 'none';
      this.indicator.style.inlineSize = `${tabRect.width}px`;
      this.indicator.style.transform = `translateX(${tabRect.left - listRect.left}px)`;
      if (!animate) requestAnimationFrame(() => (this.indicator.style.transition = ''));
    }
  }
  customElements.define('tab-switcher', TabSwitcher);

  /* ---------------------------------------------------------------- reveal
     Only elements that start below the fold are hidden, then revealed as they
     scroll into view — content is never hidden if this script doesn't run. */
  const revealTargets = [...document.querySelectorAll('[data-reveal]')];
  if (revealTargets.length && document.body.classList.contains('has-reveal') && !reduceMotion.matches && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.remove('reveal-pending');
          io.unobserve(entry.target);
        }),
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    );
    const fold = window.innerHeight;
    revealTargets.forEach((el) => {
      if (el.getBoundingClientRect().top < fold) return;
      el.classList.add('reveal-pending');
      io.observe(el);
    });
  }

  /* ---------------------------------------------------------------- share */
  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-share]');
    if (!button) return;
    const url = button.dataset.shareUrl || window.location.href;
    const title = button.dataset.shareTitle || document.title;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        Maison.toast(Maison.strings?.linkCopied || 'Link copied');
      }
    } catch (_) {
      /* user cancelled */
    }
  });
})();
