(() => {
  const keyFor = (kind, number) => `${location.pathname}:${kind}:${number}`;

  document.querySelectorAll('[data-adt-drawing]').forEach((tool, index) => {
    const canvas = tool.querySelector('canvas');
    const clear = tool.querySelector('[data-clear-drawing]');
    if (!canvas || !clear) return;
    const context = canvas.getContext('2d');
    const storageKey = keyFor('drawing', index);
    let drawing = false;
    let previous = null;

    const sizeCanvas = () => {
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(320, Math.floor(canvas.clientWidth));
      const height = 260;
      const snapshot = canvas.toDataURL();
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, width, height);
      if (snapshot && snapshot !== 'data:,') {
        const image = new Image();
        image.onload = () => context.drawImage(image, 0, 0, width, height);
        image.src = snapshot;
      }
    };
    const point = event => {
      const box = canvas.getBoundingClientRect();
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    const save = () => localStorage.setItem(storageKey, canvas.toDataURL('image/png'));
    const start = event => {
      drawing = true;
      previous = point(event);
      canvas.setPointerCapture?.(event.pointerId);
    };
    const move = event => {
      if (!drawing || !previous) return;
      const next = point(event);
      context.strokeStyle = '#0f172a';
      context.lineWidth = 2.5;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(next.x, next.y);
      context.stroke();
      previous = next;
    };
    const stop = () => {
      if (!drawing) return;
      drawing = false;
      previous = null;
      save();
    };

    sizeCanvas();
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const image = new Image();
      image.onload = () => context.drawImage(image, 0, 0, canvas.clientWidth, 260);
      image.src = saved;
    }
    canvas.addEventListener('pointerdown', start);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    clear.addEventListener('click', () => {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.clientWidth, 260);
      localStorage.removeItem(storageKey);
      canvas.focus();
    });
  });

  document.querySelectorAll('[data-adt-recorder]').forEach((tool, index) => {
    const record = tool.querySelector('[data-record]');
    const playback = tool.querySelector('audio');
    const status = tool.querySelector('[data-recording-status]');
    if (!record || !playback || !status || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      if (status) status.textContent = 'Audio recording is not available in this browser.';
      return;
    }
    let recorder;
    let parts = [];
    record.addEventListener('click', async () => {
      if (recorder?.state === 'recording') {
        recorder.stop();
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        parts = [];
        recorder = new MediaRecorder(stream);
        recorder.ondataavailable = event => event.data.size && parts.push(event.data);
        recorder.onstop = () => {
          playback.src = URL.createObjectURL(new Blob(parts, { type: recorder.mimeType || 'audio/webm' }));
          playback.hidden = false;
          status.textContent = 'Recording ready for playback or teacher review.';
          record.textContent = 'Record again';
          stream.getTracks().forEach(track => track.stop());
        };
        recorder.start();
        record.textContent = 'Stop recording';
        status.textContent = 'Recording in progress…';
      } catch {
        status.textContent = 'Microphone permission is needed to record your answer.';
      }
    });
  });
})();
