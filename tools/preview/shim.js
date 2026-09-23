/* Preview-only shim: stands in for Shopify's server so the static preview is clickable.
   Never shipped to the store (it lives in tools/, not assets/). */
(() => {
  const P = window.__PREVIEW__ || {};
  const ar = P.locale === 'ar';
  const t = (en, arText) => (ar ? arText : en);
  const toast = (msg) => (window.Maison && window.Maison.toast ? window.Maison.toast(msg, 4200) : alert(msg));

  // Mock the Ajax Cart API used by the product wizard.
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    if (/\/cart(\/(add|change|update|clear))?(\.js)?(\?|$)/.test(url)) {
      return Promise.resolve(new Response(JSON.stringify({ items: [], item_count: 1 }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return realFetch(input, init);
  };

  document.addEventListener(
    'submit',
    (event) => {
      const form = event.target;
      const type = form.querySelector('input[name="form_type"]')?.value;
      if (!type) return;
      if (type === 'localization') {
        event.preventDefault();
        const submitter = event.submitter;
        if (submitter?.name === 'language_code') {
          const want = submitter.value;
          if (want !== P.locale && P.alt) window.location.href = P.alt;
        } else {
          toast(t('Currency switching is handled by Shopify Markets once the store is live.', 'يتم تبديل العملة عبر Shopify Markets عند إطلاق المتجر.'));
        }
        return;
      }
      if (type === 'product') {
        if (event.defaultPrevented) return;
        event.preventDefault();
        window.location.href = P.cart;
        return;
      }
      if (type === 'customer_login' || type === 'create_customer') {
        event.preventDefault();
        window.location.href = P.account;
        return;
      }
      if (type === 'cart') {
        event.preventDefault();
        toast(t('Checkout opens Shopify’s secure checkout once the store is live.', 'تُفتح صفحة الدفع الآمنة من Shopify عند إطلاق المتجر.'));
        return;
      }
      event.preventDefault();
      toast(t('Preview: this form works once the store is live on Shopify.', 'معاينة: يعمل هذا النموذج عند إطلاق المتجر على Shopify.'));
    },
    true,
  );

  // Floating preview badge with quick links.
  const style = document.createElement('style');
  style.textContent = `
    .pv-badge{position:fixed;z-index:9999;inset-block-end:14px;inset-inline-start:14px;display:flex;gap:6px;align-items:center;font:500 12px/1 system-ui,sans-serif;letter-spacing:0}
    .pv-badge a,.pv-badge span{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;background:#1F1D1Ae6;color:#F7F3EC;text-decoration:none;backdrop-filter:blur(8px)}
    .pv-badge span{background:#A9824F}
    @media print{.pv-badge{display:none}}`;
  document.head.appendChild(style);
  const badge = document.createElement('div');
  badge.className = 'pv-badge';
  badge.innerHTML = `<span>${t('Preview', 'معاينة')}</span><a href="${P.index}">${t('All pages', 'كل الصفحات')}</a>${P.alt ? `<a href="${P.alt}">${ar ? 'English' : 'العربية'}</a>` : ''}`;
  if (!new URLSearchParams(location.search).has('embed') && !document.documentElement.hasAttribute('data-no-preview-badge')) {
    window.addEventListener('DOMContentLoaded', () => document.body.appendChild(badge));
  }
})();
