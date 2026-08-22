/*
 * Present the exact, watermark-free source PDF page while retaining the
 * converted HTML for read-aloud, image descriptions, navigation, and other
 * accessibility tools.
 */
(() => {
  const titleId = document.querySelector('meta[name="title-id"]')?.content || '';
  const match = titleId.match(/^pg(\d{3})_/);
  if (!match) return;

  const pageNumber = Number(match[1]);
  if (pageNumber < 1 || pageNumber > 184) return;

  const content = document.getElementById('content');
  if (!content || content.querySelector('.pdf-page-facsimile')) return;

  const accessibleChildren = Array.from(content.children);
  accessibleChildren.forEach((child) => {
    child.classList.add('pdf-facsimile-accessible-source');
  });

  const image = document.createElement('img');
  image.className = 'pdf-page-facsimile';
  image.src = `images/pdf-pages/pg-${String(pageNumber).padStart(3, '0')}.jpg?v=2`;
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.decoding = 'async';
  image.fetchPriority = 'high';
  content.prepend(image);
})();
