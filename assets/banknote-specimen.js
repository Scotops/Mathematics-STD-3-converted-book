(() => {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img[data-banknote-specimen]').forEach((image) => {
      const wrapper = document.createElement('span');
      wrapper.style.cssText = 'position:relative;display:block;overflow:hidden;border-radius:0.25rem;';
      image.parentNode.insertBefore(wrapper, image);
      wrapper.appendChild(image);
      const label = document.createElement('span');
      label.textContent = 'SPECIMEN';
      label.setAttribute('aria-hidden', 'true');
      label.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;color:rgba(110,20,20,.58);font:700 clamp(1.2rem,4vw,2.4rem)/1 Arial,sans-serif;letter-spacing:.16em;text-shadow:0 1px 1px rgba(255,255,255,.55);transform:rotate(-18deg);';
      wrapper.appendChild(label);
    });
  });
})();
