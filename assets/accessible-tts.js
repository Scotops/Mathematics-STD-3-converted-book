/*
 * Shared Read Aloud replacement for the ADT pages.
 * It deliberately uses the rendered page rather than the short audio map so
 * every visible question, table cell and answer field is narrated.
 */
(() => {
  'use strict';

  const MAX_CHUNK_LENGTH = 180;
  const ENGLISH_LANG = 'en-US';
  const synth = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  const canUseWebSpeech = Boolean(synth && typeof synth.speak === 'function' && typeof Utterance === 'function');
  let playing = false;
  let cancelled = false;
  let queue = [];
  let queueIndex = 0;
  let keepAliveTimer = null;
  let suppressBundledAudio = canUseWebSpeech;
  let pendingControlTimer = null;
  let sessionVoice = null;
  const trackedAudio = new Set();

  const nativeMediaPlay = window.HTMLMediaElement?.prototype?.play;
  if (nativeMediaPlay) {
    window.HTMLMediaElement.prototype.play = function (...args) {
      if (this instanceof HTMLAudioElement) trackedAudio.add(this);
      if (suppressBundledAudio && this instanceof HTMLAudioElement) {
        this.pause();
        this.currentTime = 0;
        return Promise.resolve();
      }
      return nativeMediaPlay.apply(this, args);
    };
  }

  // The bundled reader creates detached audio objects with `new Audio()`.
  // Track those objects as soon as the page starts so they can never continue
  // underneath the single Web Speech narrator.
  const NativeAudio = window.Audio;
  if (typeof NativeAudio === 'function') {
    const TrackedAudio = function (...args) {
      const audio = new NativeAudio(...args);
      trackedAudio.add(audio);
      return audio;
    };
    TrackedAudio.prototype = NativeAudio.prototype;
    Object.setPrototypeOf(TrackedAudio, NativeAudio);
    window.Audio = TrackedAudio;
  }

  const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'PATH', 'IFRAME']);
  const blockTags = new Set(['P', 'LI', 'DT', 'DD', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'FIGCAPTION', 'CAPTION', 'ARTICLE', 'SECTION']);

  function isVisible(element) {
    if (!(element instanceof Element)) return true;
    if (element.hidden || element.getAttribute('aria-hidden') === 'true' || element.dataset.ttsIgnore !== undefined) return false;
    const style = window.getComputedStyle(element);
    // Some older pages contain a narration-only duplicate that is clipped to
    // one pixel for the old audio runtime. It is not page content and must not
    // be narrated a second time.
    if (style.clip !== 'auto' && Number.parseFloat(style.width) <= 1 && Number.parseFloat(style.height) <= 1) return false;
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function fieldText(element) {
    const type = (element.getAttribute('type') || '').toLowerCase();
    if (type === 'hidden' || type === 'button' || type === 'submit' || type === 'reset') return '';
    if (type === 'checkbox' || type === 'radio') return element.checked ? ' selected' : '';
    const value = String(element.value || '').trim();
    // An empty learner input represents the printed line/blank in the book.
    return value || ' __adt_empty_field__ ';
  }

  function mathText(element) {
    if (!(element instanceof Element)) return String(element?.textContent || '').trim();
    const tag = element.tagName.toUpperCase();
    const children = [...element.children];
    if (tag === 'MFRAC' && children.length >= 2) {
      return `${mathText(children[0])} over ${mathText(children[1])}`;
    }
    if (tag === 'MO') {
      const operator = element.textContent.trim();
      return ({ '+': 'plus', '=': 'equals', '−': 'minus', '-': 'minus', '×': 'times', '÷': 'divided by' })[operator] || operator;
    }
    if (!children.length) return element.textContent.trim();
    return children.map(mathText).filter(Boolean).join(' ');
  }

  function extractPageText() {
    const root = document.querySelector('#content') || document.body;
    const pieces = [];
    const add = (value) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text) pieces.push(text);
    };
    const boundary = () => pieces.push('. ');

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        add(node.nodeValue);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node;
      if (ignoredTags.has(element.tagName) || !isVisible(element)) return;

      if (element.dataset.ttsText) {
        add(element.dataset.ttsText);
        return;
      }

      if (element.matches('input, textarea, select')) {
        add(fieldText(element));
        return;
      }
      if (element.tagName === 'IMG') {
        add(element.getAttribute('alt'));
        return;
      }
      if (element.tagName === 'MATH') {
        add(mathText(element));
        return;
      }

      // Keep a visually styled number together when one of its digits is
      // wrapped for underlining, shading or emphasis. Limiting this to an
      // individual inline span prevents unrelated values in diagrams and
      // layouts from being combined.
      if (element.tagName === 'SPAN' && element.children.length && !element.querySelector('input, textarea, select, img, math')) {
        const compactNumber = String(element.textContent || '').replace(/\s+/g, '');
        if (/^\d[\d,.]*$/.test(compactNumber)) {
          add(compactNumber);
          return;
        }
      }

      const tag = element.tagName;
      const isRow = tag === 'TR';
      const isCell = tag === 'TD' || tag === 'TH';
      if (blockTags.has(tag) || isRow) boundary();
      for (const child of element.childNodes) walk(child);
      if (isCell) pieces.push(', ');
      if (tag === 'BR' || blockTags.has(tag) || isRow) boundary();
    }

    walk(root);
    return pieces.join(' ').replace(/\s+([,.;:?!])/g, '$1').replace(/(?:\.\s*){2,}/g, '. ').trim();
  }

  const SMALL_NUMBERS = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
    'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen'
  ];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  function integerToWords(value) {
    if (!Number.isSafeInteger(value) || value < 0) return String(value);
    if (value < 20) return SMALL_NUMBERS[value];
    if (value < 100) {
      const remainder = value % 10;
      return `${TENS[Math.floor(value / 10)]}${remainder ? `-${SMALL_NUMBERS[remainder]}` : ''}`;
    }
    if (value < 1000) {
      const remainder = value % 100;
      return `${SMALL_NUMBERS[Math.floor(value / 100)]} hundred${remainder ? ` and ${integerToWords(remainder)}` : ''}`;
    }
    const scales = [
      [1_000_000_000, 'billion'],
      [1_000_000, 'million'],
      [1_000, 'thousand']
    ];
    for (const [size, name] of scales) {
      if (value >= size) {
        const leading = Math.floor(value / size);
        const remainder = value % size;
        const joiner = remainder && remainder < 100 ? ' and ' : ' ';
        return `${integerToWords(leading)} ${name}${remainder ? `${joiner}${integerToWords(remainder)}` : ''}`;
      }
    }
    return String(value);
  }

  function numberTokenToWords(token) {
    const compact = token.replace(/,/g, '');
    const [whole, fraction] = compact.split('.');
    // Preserve leading zeroes because they carry meaning in times, decimals,
    // identifiers and written arithmetic.
    const wholeWords = whole.length > 1 && whole.startsWith('0')
      ? [...whole].map((digit) => SMALL_NUMBERS[Number(digit)]).join(' ')
      : integerToWords(Number(whole));
    if (fraction === undefined) return wholeWords;
    const fractionWords = [...fraction].map((digit) => SMALL_NUMBERS[Number(digit)]).join(' ');
    return `${wholeWords} point ${fractionWords}`;
  }

  function expandNumbersForSpeech(text) {
    return String(text || '').replace(/\b\d[\d,]*(?:\.\d+)?\b/g, numberTokenToWords);
  }

  function sanitizeForSpeech(text) {
    const sanitized = String(text || '')
      // Item markers must be spoken as English letters, without parentheses.
      .replace(/\(\s*([a-z])\s*\)/gi, (_, letter) => ` ${letter.toUpperCase()}, `)
      // Underlines and empty inputs are the blanks printed in the original book.
      .replace(/\[\[\s*blank(?::[^\]]*)?\s*\]\]/gi, ' dash ')
      .replace(/__adt_empty_field__/g, ' dash ')
      .replace(/_{2,}/g, ' dash ')
      .replace(/≤/g, ' less than or equal to ')
      .replace(/≥/g, ' greater than or equal to ')
      .replace(/≠/g, ' not equal to ')
      .replace(/÷|∕/g, ' divided by ')
      .replace(/[×✕]/g, ' times ')
      .replace(/\+/g, ' plus ')
      .replace(/=/g, ' equals ')
      .replace(/(\d)\s*-\s*(\d)/g, '$1 minus $2')
      .replace(/\//g, ' divided by ')
      .replace(/(\d)\s*[−–—-]\s*(\d)/g, '$1 minus $2')
      .replace(/\s*<\s*/g, ' less than ')
      .replace(/\s*>\s*/g, ' greater than ')
      .replace(/\s+/g, ' ')
      .trim();
    return expandNumbersForSpeech(sanitized);
  }

  function splitIntoChunks(text, maxLength = MAX_CHUNK_LENGTH) {
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];
    const chunks = [];
    let current = '';
    const push = () => { if (current.trim()) chunks.push(current.trim()); current = ''; };
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > maxLength && current) push();
        current = current ? `${current} ${word}` : word;
      }
      if (current.length >= Math.floor(maxLength * 0.65)) push();
    }
    push();
    return chunks;
  }

  function preferredVoice() {
    if (!canUseWebSpeech || typeof synth.getVoices !== 'function') return null;
    const voices = synth.getVoices();
    const english = voices.filter((voice) => /^en([_-]|$)/i.test(voice.lang));
    const pool = english.length ? english : voices;
    const score = (voice) => {
      const name = voice.name.toLowerCase();
      let value = 0;
      if (voice.localService) value += 12;
      if (/microsoft (david|mark|guy)|google (us|uk) english|alex|daniel|james|george|ryan|male/.test(name)) value += 10;
      if (/natural|premium|enhanced|neural/.test(name)) value += 6;
      if (/zira|susan|female|zira/.test(name)) value -= 2;
      return value;
    };
    return pool.sort((a, b) => score(b) - score(a))[0] || null;
  }

  function finish() {
    playing = false;
    cancelled = false;
    queue = [];
    queueIndex = 0;
    if (keepAliveTimer) {
      window.clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    document.documentElement.classList.remove('adt-tts-playing');
  }

  function stopBundledAudio() {
    const allAudio = new Set([...trackedAudio, ...document.querySelectorAll('audio')]);
    allAudio.forEach((audio) => {
      audio.pause();
      try { audio.currentTime = 0; } catch {}
    });
  }

  function playNext() {
    if (cancelled || queueIndex >= queue.length) return finish();
    const utterance = new Utterance(queue[queueIndex++]);
    const voice = sessionVoice;
    utterance.lang = voice?.lang || ENGLISH_LANG;
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onend = () => window.setTimeout(playNext, 30);
    utterance.onerror = (event) => {
      // "interrupted" is expected when Stop is pressed; other failures should
      // not prevent the rest of the page from being read.
      if (!cancelled && event.error !== 'interrupted' && event.error !== 'canceled') window.setTimeout(playNext, 30);
    };
    synth.speak(utterance);
  }

  function start() {
    const text = sanitizeForSpeech(extractPageText());
    if (!text) return;
    if (!canUseWebSpeech) return;
    suppressBundledAudio = true;
    stopBundledAudio();
    synth.cancel();
    sessionVoice = preferredVoice();
    cancelled = false;
    queue = splitIntoChunks(text);
    queueIndex = 0;
    playing = true;
    // Chromium can pause a long Web Speech API session even though it still
    // reports itself as speaking. Keeping it alive avoids a page stopping
    // after an otherwise ordinary list item such as (c).
    if (keepAliveTimer) window.clearInterval(keepAliveTimer);
    keepAliveTimer = window.setInterval(() => {
      if (playing && !cancelled && synth.speaking && !synth.paused) {
        synth.resume();
      }
    }, 7000);
    document.documentElement.classList.add('adt-tts-playing');
    playNext();
  }

  function stop() {
    cancelled = true;
    if (canUseWebSpeech) synth.cancel();
    suppressBundledAudio = canUseWebSpeech;
    finish();
  }

  function isReadAloudControl(control) {
    if (!(control instanceof Element)) return false;
    const hint = [
      control.getAttribute('aria-label'), control.getAttribute('title'),
      control.dataset?.action, control.dataset?.feature, control.className
    ].filter(Boolean).join(' ').toLowerCase();
    return /read[\s-]?aloud|text[\s-]?to[\s-]?speech|tts|audio/.test(hint);
  }

  // Capture before the bundled audio player. This leaves all other dock tools
  // alone while making the book's speaker control reliably narrate the page.
  window.addEventListener('pointerdown', (event) => {
    const control = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null;
    if (!canUseWebSpeech || !isReadAloudControl(control)) return;
    suppressBundledAudio = true;
    stopBundledAudio();
    if (pendingControlTimer) window.clearTimeout(pendingControlTimer);
    pendingControlTimer = window.setTimeout(() => {
      if (!playing) suppressBundledAudio = canUseWebSpeech;
    }, 1200);
  }, true);

  window.addEventListener('click', (event) => {
    const control = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null;
    if (!isReadAloudControl(control)) return;
    // If a browser has no Web Speech API, preserve the ADT's bundled reader.
    if (!canUseWebSpeech) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pendingControlTimer) {
      window.clearTimeout(pendingControlTimer);
      pendingControlTimer = null;
    }
    playing ? stop() : start();
  }, true);

  // Exposed for the existing audio-button event handler and for testing.
  window.ADTAccessibleTTS = Object.freeze({
    extractPageText,
    expandNumbersForSpeech,
    integerToWords,
    sanitizeForSpeech,
    splitIntoChunks,
    start,
    stop,
    toggle: () => (playing ? stop() : start()),
    get isPlaying() { return playing; }
  });

  if (canUseWebSpeech && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', preferredVoice);
  }
})();
