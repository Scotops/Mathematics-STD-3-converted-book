(() => {
  const section = document.querySelector('meta[name="page-section-id"]')?.getAttribute('content');
  if (!section || document.getElementById('adt-page-number')) return;
  const page = document.createElement('div');
  page.id = 'adt-page-number';
  page.textContent = `Page ${section}`;
  page.setAttribute('aria-label', `ADT page ${section}`);
  page.style.cssText = 'position:fixed;right:1rem;bottom:1rem;z-index:45;padding:.35rem .6rem;border-radius:999px;background:rgba(15,23,42,.86);color:#fff;font:600 .8rem/1 system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.25);pointer-events:none';
  document.body.appendChild(page);
})();
