(() => {
  const segments = [
    ["pg103_n0006", "PQ", "4"],
    ["pg103_n0007", "CD", "5"],
    ["pg103_n0008", "LM", "6"],
    ["pg103_n0009", "JK", "7"],
    ["pg103_n0010", "XY", "8"],
    ["pg103_n0011", "EF", "9"],
    ["pg103_n0012", "MN", "10"]
  ];

  const render = () => {
    segments.forEach(([id, letters, length]) => {
      const source = document.querySelector(`[data-id="${id}"]`);
      if (!source || source.dataset.segmentEnhanced === "true") return;

      source.dataset.segmentEnhanced = "true";
      source.classList.add("sr-only");

      const visual = document.createElement("span");
      visual.className = "segment-visual";
      visual.setAttribute("aria-hidden", "true");
      visual.innerHTML = `<span class="segment-name">${letters}</span> = ${length} cm`;
      source.insertAdjacentElement("afterend", visual);

      const row = source.closest("div.flex");
      const drawingBox = row?.querySelector("input");
      if (drawingBox) drawingBox.remove();
    });

    const optionKinds = ["ray", "line", "segment", "plain"];
    document.querySelectorAll(".activity-option").forEach((label, index) => {
      if (label.dataset.segmentOptionEnhanced === "true" || index > 3) return;
      label.dataset.segmentOptionEnhanced = "true";
      const original = label.querySelector("span:last-child");
      if (original) original.classList.add("sr-only");
      const visual = document.createElement("span");
      visual.className = `segment-option segment-option-${optionKinds[index]}`;
      visual.setAttribute("aria-hidden", "true");
      visual.textContent = "AB";
      label.appendChild(visual);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }
  setTimeout(render, 300);
  setTimeout(render, 900);
})();
