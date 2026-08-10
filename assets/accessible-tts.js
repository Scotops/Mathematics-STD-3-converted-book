/*
 * Shared Read Aloud replacement for the ADT pages.
 * It deliberately uses the rendered page rather than the short audio map so
 * every visible question, table cell and answer field is narrated.
 */
(() => {
  'use strict';

  const MAX_CHUNK_LENGTH = 180;
  const ENGLISH_LANG = 'en-US';
  let playing = false;
  let cancelled = false;
  let queue = [];
  let queueIndex = 0;
  let keepAliveTimer = null;

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

      if (element.matches('input, textarea, select')) {
        add(fieldText(element));
        return;
      }
      if (element.tagName === 'IMG') {
        add(element.getAttribute('alt'));
        return;
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

  function sanitizeForSpeech(text) {
    return String(text || '')
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
    const voices = window.speechSynthesis.getVoices();
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

  function playNext() {
    if (cancelled || queueIndex >= queue.length) return finish();
    const utterance = new SpeechSynthesisUtterance(queue[queueIndex++]);
    const voice = preferredVoice();
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
    window.speechSynthesis.speak(utterance);
  }

  function start() {
    const text = sanitizeForSpeech(extractPageText());
    if (!text) return;
    window.speechSynthesis.cancel();
    cancelled = false;
    queue = splitIntoChunks(text);
    queueIndex = 0;
    playing = true;
    // Chromium can pause a long Web Speech API session even though it still
    // reports itself as speaking. Keeping it alive avoids a page stopping
    // after an otherwise ordinary list item such as (c).
    if (keepAliveTimer) window.clearInterval(keepAliveTimer);
    keepAliveTimer = window.setInterval(() => {
      if (playing && !cancelled && speechSynthesis.speaking && !speechSynthesis.paused) {
        speechSynthesis.resume();
      }
    }, 7000);
    document.documentElement.classList.add('adt-tts-playing');
    playNext();
  }

  function stop() {
    cancelled = true;
    window.speechSynthesis.cancel();
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
  document.addEventListener('click', (event) => {
    const control = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null;
    if (!isReadAloudControl(control)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    playing ? stop() : start();
  }, true);

  // Exposed for the existing audio-button event handler and for testing.
  window.ADTAccessibleTTS = Object.freeze({
    extractPageText,
    sanitizeForSpeech,
    splitIntoChunks,
    start,
    stop,
    toggle: () => (playing ? stop() : start()),
    get isPlaying() { return playing; }
  });

  window.speechSynthesis.addEventListener?.('voiceschanged', preferredVoice);
})();
