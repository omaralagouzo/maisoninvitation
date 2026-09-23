/* Maison — product page: gallery + 3-step invitation wizard. */
(() => {
  /* ---------------------------------------------------------------- gallery */
  class ProductGallery extends HTMLElement {
    connectedCallback() {
      this.slides = [...this.querySelectorAll('[data-media-id]')];
      this.thumbs = [...this.querySelectorAll('[data-thumb]')];
      this.thumbs.forEach((t) => t.addEventListener('click', () => this.show(t.dataset.thumb)));
      document.addEventListener('variant:change', (e) => e.detail.media && this.show(e.detail.media));
    }
    show(id) {
      if (!this.slides.some((s) => s.dataset.mediaId === String(id))) return;
      this.slides.forEach((s) => s.classList.toggle('is-active', s.dataset.mediaId === String(id)));
      this.thumbs.forEach((t) => (t.dataset.thumb === String(id) ? t.setAttribute('aria-current', 'true') : t.removeAttribute('aria-current')));
    }
  }
  customElements.define('product-gallery', ProductGallery);

  /* ---------------------------------------------------------------- wizard */
  class ProductWizard extends HTMLElement {
    connectedCallback() {
      this.form = this.querySelector('form');
      this.steps = [...this.querySelectorAll('[data-step]')];
      this.progress = [...this.querySelectorAll('[data-goto]')];
      this.current = 0;
      this.maxReached = 0;
      this.form.classList.add('is-enhanced');

      this.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => this.go(this.current + 1)));
      this.querySelectorAll('[data-prev]').forEach((b) => b.addEventListener('click', () => this.go(this.current - 1)));
      this.progress.forEach((b) => b.addEventListener('click', () => this.go(Number(b.dataset.goto))));

      this.variantInputs = [...this.form.querySelectorAll('input[name="id"]')];
      this.variantInputs.forEach((i) => i.addEventListener('change', () => this.onVariant()));
      const fromUrl = new URLSearchParams(window.location.search).get('variant');
      const preset = fromUrl && this.variantInputs.find((i) => i.value === fromUrl && !i.disabled);
      if (preset) preset.checked = true;

      this.rsvpMethod = this.form.querySelector('[data-rsvp-method]');
      this.rsvpMethod?.addEventListener('change', () => this.onRsvp());

      this.addons = [...this.form.querySelectorAll('[data-addon]')];
      this.addons.forEach((a) => a.addEventListener('change', () => this.updateTotal()));
      this.paymentButton = this.form.querySelector('[data-payment-button]');
      this.form.addEventListener('submit', (e) => this.onSubmit(e));

      this.onVariant(false);
      this.onRsvp();
      this.render();
    }

    get variant() {
      return this.variantInputs.find((i) => i.checked) || this.variantInputs[0];
    }

    go(index) {
      if (index < 0 || index >= this.steps.length) return;
      if (index > this.current && !this.validate(this.current)) return;
      if (index > this.maxReached + 1) return;
      this.current = index;
      this.maxReached = Math.max(this.maxReached, index);
      if (index === this.steps.length - 1) this.updateSummary();
      this.render();
      const top = this.getBoundingClientRect().top + window.scrollY - 110;
      if (window.scrollY > top) window.scrollTo({ top, behavior: 'smooth' });
      this.steps[index].querySelector('input:not([type=hidden]):not([disabled]), select, textarea, button')?.focus({ preventScroll: true });
    }

    validate(index) {
      const fields = [...this.steps[index].querySelectorAll('input, select, textarea')].filter((f) => !f.closest('[hidden]'));
      for (const field of fields) {
        if (!field.checkValidity()) {
          field.reportValidity();
          return false;
        }
      }
      return true;
    }

    render() {
      this.steps.forEach((s, i) => s.classList.toggle('is-current', i === this.current));
      this.progress.forEach((p, i) => {
        p.classList.toggle('is-current', i === this.current);
        p.classList.toggle('is-done', i < this.current);
        p.setAttribute('aria-current', i === this.current ? 'step' : 'false');
      });
    }

    onVariant(pushUrl = true) {
      const v = this.variant;
      if (!v) return;
      const lang = v.dataset.lang;
      this.querySelectorAll('[data-when-lang]').forEach((el) => (el.hidden = !el.dataset.whenLang.split(' ').includes(lang)));
      const names = this.form.querySelectorAll('[name="properties[Name 1]"], [name="properties[Name 2]"]');
      names.forEach((n) => {
        n.dir = lang === 'ar' ? 'rtl' : 'auto';
        n.lang = lang === 'ar' ? 'ar' : '';
      });
      const price = document.querySelector('[data-product-price]');
      if (price) price.textContent = v.dataset.priceLabel;
      this.updateTotal();
      document.dispatchEvent(new CustomEvent('variant:change', { detail: { id: v.value, media: v.dataset.media } }));
      if (pushUrl && window.history.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', v.value);
        window.history.replaceState({}, '', url);
      }
    }

    onRsvp() {
      const method = this.rsvpMethod?.value;
      this.querySelectorAll('[data-when-rsvp]').forEach((el) => {
        el.hidden = el.dataset.whenRsvp !== method;
        el.querySelectorAll('input').forEach((i) => (i.required = !el.hidden));
      });
    }

    formatMoney(cents) {
      const el = this.querySelector('[data-summary-total]');
      const format = el?.dataset.moneyFormat || '{{amount}}';
      const amount = (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return format
        .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100).toLocaleString('en-US'))
        .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, amount.replace('.', ','))
        .replace(/\{\{\s*amount\s*\}\}/, amount)
        .replace(/<[^>]+>/g, '')
        .replace(/^/, '\u2066')
        .replace(/$/, '\u2069');
    }

    updateTotal() {
      const selected = this.addons.filter((a) => a.checked);
      const total = Number(this.variant?.dataset.price || 0) + selected.reduce((sum, a) => sum + Number(a.dataset.price), 0);
      const el = this.querySelector('[data-summary-total]');
      if (el) el.textContent = this.formatMoney(total);
      // Accelerated checkout buttons only buy the main item — hide them while add-ons are chosen.
      if (this.paymentButton) this.paymentButton.hidden = selected.length > 0;
    }

    updateSummary() {
      const list = this.querySelector('[data-summary-list]');
      const missing = list.dataset.missing;
      const val = (name) => this.form.querySelector(`[name="properties[${name}]"]`)?.value.trim() || '';
      const set = (key, text) => {
        const dd = list.querySelector(`[data-summary-out="${key}"]`);
        dd.textContent = text || missing;
        dd.dir = 'auto';
        dd.classList.toggle('is-missing', !text);
      };
      const n1 = val('Name 1');
      const n2 = val('Name 2');
      set('names', n1 && n2 ? `${n1} & ${n2}` : n1 || n2);
      if (/[\u0600-\u06FF]/.test(n1 + n2)) list.querySelector('[data-summary-out="names"]').textContent = `${n1} و ${n2}`;
      const date = val('Wedding date');
      let pretty = date;
      if (date) {
        const [y, m, d] = date.split('-').map(Number);
        try {
          pretty = new Date(y, m - 1, d).toLocaleDateString(document.documentElement.lang || 'en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        } catch (_) {}
      }
      set('date', pretty);
      set('venue', [val('Venue'), val('City')].filter(Boolean).join(', '));
      set('language', this.variant?.dataset.title);
    }

    async onSubmit(event) {
      for (let i = 0; i < this.steps.length; i++) {
        if (!this.validate(i)) {
          event.preventDefault();
          this.current = i;
          this.render();
          return;
        }
      }
      const selected = this.addons.filter((a) => a.checked);
      if (!selected.length) return; // native submit → /cart/add → cart page
      event.preventDefault();
      const submit = this.querySelector('[data-submit]');
      const label = submit.textContent;
      submit.disabled = true;
      submit.textContent = window.Maison?.strings?.adding || 'Adding…';
      const properties = {};
      new FormData(this.form).forEach((value, key) => {
        const m = key.match(/^properties\[(.+)\]$/);
        if (m && String(value).trim()) properties[m[1]] = value;
      });
      const items = [{ id: Number(this.variant.value), quantity: 1, properties }, ...selected.map((a) => ({ id: Number(a.dataset.addon), quantity: 1 }))];
      try {
        const res = await fetch(`${this.dataset.cartAdd}.js`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ items }),
        });
        if (!res.ok) throw new Error((await res.json()).description || res.statusText);
        window.location.href = this.dataset.cartUrl;
      } catch (err) {
        const error = this.querySelector('[data-form-error]');
        error.textContent = err.message || window.Maison?.strings?.error;
        error.hidden = false;
        submit.disabled = false;
        submit.textContent = label;
      }
    }
  }
  customElements.define('product-wizard', ProductWizard);
})();
