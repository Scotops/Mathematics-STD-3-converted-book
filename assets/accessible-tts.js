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
  let paused = false;
  let speechRate = 1;
  let speechVolume = 1;
  let playbackGeneration = 0;
  let activeHighlight = null;
  let activeWordRanges = [];
  let player = null;
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
    const explicitLabel = String(element.getAttribute('aria-label') || '').trim();
    if (explicitLabel && (tag === 'MFRAC' || element.getAttribute('role') === 'math')) {
      return explicitLabel;
    }
    if (element.getAttribute('aria-hidden') === 'true') return '';
    const children = [...element.children];
    if (tag === 'MFRAC' && children.length >= 2) {
      return `${mathText(children[0])} over ${mathText(children[1])}`;
    }
    // MathJax converts source MathML into these CHTML elements. Preserve the
    // numerator/denominator boundary so 3/4 is never spoken as "three four".
    if (tag === 'MJX-MFRAC' || element.classList.contains('mjx-mfrac')) {
      const numerator = element.querySelector('mjx-num, .mjx-num');
      const denominator = element.querySelector('mjx-den, .mjx-den');
      if (numerator && denominator) return `${mathText(numerator)} over ${mathText(denominator)}`;
    }
    if (tag === 'MO') {
      const operator = element.textContent.trim();
      return ({ '+': 'plus', '=': 'equals', '−': 'minus', '-': 'minus', '×': 'times', '÷': 'divided by' })[operator] || operator;
    }
    if (!children.length) return element.textContent.trim();
    return children.map(mathText).filter(Boolean).join(' ');
  }

  function extractPageText(rootOverride = null) {
    const root = rootOverride || document.querySelector('#content') || document.body;
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

      // Exercise question numbers need their own spoken beat. The pause token
      // is handled by the playback queue and is never sent to the voice.
      const visibleText = String(element.textContent || '').trim();
      if (element.tagName === 'SPAN' && /^\d+\.$/.test(visibleText)) {
        add(`Question ${visibleText} [[adt_pause]]`);
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
      if (element.tagName === 'MJX-MFRAC' || element.classList.contains('mjx-mfrac')) {
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
          const underlined = [...element.querySelectorAll('span')]
            .filter((child) => /underline/i.test(child.style.textDecoration || child.style.textDecorationLine || ''))
            .map((child) => String(child.textContent || '').replace(/\s+/g, ''))
            .join('');
          add(underlined ? `${compactNumber}, underlined digit ${underlined}.` : compactNumber);
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

  function collectNarrationQueue() {
    const root = document.querySelector('#content') || document.body;
    const semanticSelector = 'h1,h2,h3,h4,h5,h6,p,li,dt,dd,figcaption,caption,tr,label';
    const specialSelector = 'img,[data-tts-text],[aria-label],input,textarea,select,math';
    const allElements = [...root.querySelectorAll('*')];
    const directText = (element) => [...element.childNodes]
      .some((node) => node.nodeType === Node.TEXT_NODE && /\S/.test(node.nodeValue || ''));
    const isControl = (element) => element.matches('button,[role="button"],[role="navigation"],[role="toolbar"]');
    const isCandidate = (element) => {
      if (!isVisible(element) || isControl(element)) return false;
      const semantic = element.matches(semanticSelector);
      const special = element.matches(specialSelector);
      const leafText = directText(element) && !element.matches('script,style');
      if (!semantic && !special && !leafText) return false;

      // A semantic row/paragraph or an explicit narration label owns all of
      // its descendants. This prevents repeated speech while still allowing
      // standalone layout divs (vertical arithmetic, diagrams and cards) to
      // become narration items.
      const owningAncestor = element.parentElement?.closest(`${semanticSelector},[data-tts-text],[aria-label]`);
      if (owningAncestor && owningAncestor !== root) return false;
      if (element.tagName === 'IMG') return !element.closest(semanticSelector);
      return true;
    };
    const elements = allElements.filter(isCandidate);
    const entries = [];
    for (const element of elements) {
      const explicitLabel = String(element.dataset.ttsText || element.getAttribute('aria-label') || '').trim();
      const isDirectTextUnit = !element.matches(`${semanticSelector},${specialSelector}`);
      const ownText = isDirectTextUnit
        ? [...element.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.nodeValue || '')
          .join(' ')
        : '';
      const raw = explicitLabel || (element.tagName === 'IMG'
        ? element.getAttribute('alt')
        : isDirectTextUnit ? ownText : extractPageText(element));
      const spoken = sanitizeForSpeech(raw);
      if (!spoken) continue;
      const spokenWordCount = spoken.split(/\s+/).filter(Boolean).length;
      const sourceMap = spokenToSourceWordMap(element, spokenWordCount);
      let wordOffset = 0;
      for (const chunk of splitIntoChunks(spoken)) {
        const chunkWordCount = chunk === '__adt_speech_pause__' ? 0 : chunk.split(/\s+/).filter(Boolean).length;
        entries.push(chunk === '__adt_speech_pause__'
          ? { pause: true, element }
          : { text: chunk, element, wordOffset, wordMap: sourceMap.slice(wordOffset, wordOffset + chunkWordCount) });
        wordOffset += chunkWordCount;
      }
    }
    if (!entries.length) {
      const spoken = sanitizeForSpeech(extractPageText(root));
      for (const chunk of splitIntoChunks(spoken)) {
        entries.push(chunk === '__adt_speech_pause__' ? { pause: true, element: root } : { text: chunk, element: root });
      }
    }
    return entries;
  }

  function visibleSourceWords(element) {
    if (!(element instanceof Element)) return [];
    const words = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !isVisible(parent) || ignoredTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) words.push(...((walker.currentNode.nodeValue || '').match(/\S+/g) || []));
    return words;
  }

  function spokenToSourceWordMap(element, spokenWordCount) {
    const sourceWords = visibleSourceWords(element);
    if (!sourceWords.length) return Array.from({ length: spokenWordCount }, () => 0);
    const map = [];
    sourceWords.forEach((sourceWord, sourceIndex) => {
      const expanded = sanitizeForSpeech(sourceWord).split(/\s+/).filter(Boolean);
      const repeats = Math.max(1, expanded.length);
      for (let index = 0; index < repeats; index += 1) map.push(sourceIndex);
    });
    if (map.length !== spokenWordCount) {
      // Whole-sentence punctuation cleanup can occasionally add or remove a
      // token. Preserve alignment across the entire sentence instead of
      // allowing that difference to accumulate after the first mismatch.
      return Array.from({ length: spokenWordCount }, (_, index) =>
        Math.min(sourceWords.length - 1, Math.floor(index * sourceWords.length / Math.max(1, spokenWordCount)))
      );
    }
    return map;
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
      // Numeric slashes in this chapter are fractions, not division signs.
      .replace(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/g, '$1 over $2')
      .replace(/\//g, ' divided by ')
      .replace(/(\d)\s*[−–—-]\s*(\d)/g, '$1 minus $2')
      .replace(/\s*<\s*/g, ' less than ')
      .replace(/\s*>\s*/g, ' greater than ')
      .replace(/\s+/g, ' ')
      .trim();
    return expandNumbersForSpeech(sanitized);
  }

  function splitIntoChunks(text, maxLength = MAX_CHUNK_LENGTH) {
    const pauseToken = '[[adt_pause]]';
    const sections = String(text || '').split(pauseToken);
    const chunks = [];
    sections.forEach((section, sectionIndex) => {
      const sentences = section.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [section];
      let current = '';
      const push = () => { if (current.trim()) chunks.push(current.trim()); current = ''; };
      for (const sentence of sentences) {
        const words = sentence.trim().split(/\s+/).filter(Boolean);
        for (const word of words) {
          const candidate = current ? `${current} ${word}` : word;
          if (candidate.length > maxLength && current) push();
          current = current ? `${current} ${word}` : word;
        }
        if (current.length >= Math.floor(maxLength * 0.65)) push();
      }
      push();
      if (sectionIndex < sections.length - 1) chunks.push('__adt_speech_pause__');
    });
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
    paused = false;
    cancelled = false;
    queue = [];
    queueIndex = 0;
    if (keepAliveTimer) {
      window.clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    document.documentElement.classList.remove('adt-tts-playing');
    setHighlight(null);
    updatePlayer();
  }

  function setHighlight(element) {
    if (activeHighlight === element) return;
    clearWordHighlight();
    activeHighlight = element instanceof Element ? element : null;
    if (activeHighlight) {
      activeWordRanges = wordRangesFor(activeHighlight);
      activeHighlight.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function clearWordHighlight() {
    if (window.CSS?.highlights) CSS.highlights.delete('adt-tts-word');
    const wrappedWords = activeWordRanges.filter((item) => item instanceof Element);
    const parents = new Set(wrappedWords.map((item) => item.parentNode).filter(Boolean));
    wrappedWords.forEach((item) => item.replaceWith(document.createTextNode(item.textContent || '')));
    parents.forEach((parent) => parent.normalize());
    activeWordRanges = [];
    activeHighlight = null;
  }

  function wordRangesFor(element) {
    if (!(element instanceof Element)) return [];
    const ranges = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || !isVisible(parent) || ignoredTags.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return /\S/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    const supportsCustomHighlights = Boolean(window.CSS?.highlights && typeof window.Highlight === 'function');
    for (const node of textNodes) {
      const value = node.nodeValue || '';
      if (!supportsCustomHighlights) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        for (const match of value.matchAll(/\S+/g)) {
          if (match.index > lastIndex) fragment.append(document.createTextNode(value.slice(lastIndex, match.index)));
          const token = document.createElement('span');
          token.className = 'adt-tts-word-token';
          token.textContent = match[0];
          fragment.append(token);
          ranges.push(token);
          lastIndex = match.index + match[0].length;
        }
        if (lastIndex < value.length) fragment.append(document.createTextNode(value.slice(lastIndex)));
        node.replaceWith(fragment);
        continue;
      }
      for (const match of value.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push(range);
      }
    }
    return ranges;
  }

  function showWordHighlight(wordIndex) {
    if (!activeWordRanges.length) return;
    const target = activeWordRanges[Math.min(Math.max(wordIndex, 0), activeWordRanges.length - 1)];
    if (target instanceof Element) {
      activeWordRanges.forEach((item) => item instanceof Element && item.classList.remove('adt-tts-current-word'));
      target.classList.add('adt-tts-current-word');
      return;
    }
    if (window.CSS?.highlights && typeof window.Highlight === 'function') CSS.highlights.set('adt-tts-word', new Highlight(target));
  }

  function ensurePlayer() {
    if (player?.isConnected) return player;
    const style = document.createElement('style');
    style.dataset.adtTtsStyle = '';
    style.textContent = `
      ::highlight(adt-tts-word) { background: #ffe45c; color: #111; text-decoration: underline 2px #d49400; }
      .adt-tts-word-token.adt-tts-current-word { background: #ffe45c !important; color: #111 !important; border-radius: .14em; box-shadow: 0 0 0 .12em #ffe45c; text-decoration: underline 2px #d49400; }
      .adt-accessible-tts-player { position: fixed; z-index: 2147483646; right: 1.25rem; bottom: 5.3rem; display: flex; align-items: center; gap: .45rem; padding: .55rem .7rem; color: #fff; background: #252525; border-radius: .85rem; box-shadow: 0 .35rem 1rem #0005; font: 600 16px/1.2 system-ui, sans-serif; }
      .adt-accessible-tts-player button, .adt-accessible-tts-player select { min-width: 2.7rem; min-height: 2.7rem; border: 0; border-radius: .7rem; color: #fff; background: transparent; font: inherit; cursor: pointer; }
      .adt-accessible-tts-player button:hover, .adt-accessible-tts-player button:focus-visible, .adt-accessible-tts-player select:focus-visible { background: #ffffff20; outline: 3px solid #fff; outline-offset: 1px; }
      .adt-accessible-tts-player select { min-width: 7.4rem; padding: 0 .55rem; }
      .adt-accessible-tts-player option { color: #111; background: #fff; }
      @media (max-width: 640px) { .adt-accessible-tts-player { left: .5rem; right: .5rem; bottom: 4.8rem; justify-content: center; gap: .15rem; } .adt-accessible-tts-player select { min-width: 6.2rem; } }
    `;
    document.head.append(style);
    player = document.createElement('div');
    player.className = 'adt-accessible-tts-player';
    player.setAttribute('role', 'group');
    player.setAttribute('aria-label', 'Read aloud controls');
    player.innerHTML = `
      <button type="button" data-tts-control="previous" aria-label="Previous spoken part">&#x23EE;</button>
      <button type="button" data-tts-control="pause" aria-label="Pause read aloud">&#x23F8;</button>
      <button type="button" data-tts-control="next" aria-label="Next spoken part">&#x23ED;</button>
      <button type="button" data-tts-control="stop" aria-label="Stop read aloud">&#x23F9;</button>
      <label class="sr-only" for="adt-tts-rate">Reading speed</label>
      <select id="adt-tts-rate" data-tts-control="rate" aria-label="Reading speed">
        <option value="0.75">Slow</option><option value="1" selected>Normal</option><option value="1.25">Fast</option>
      </select>
      <button type="button" data-tts-control="volume" aria-label="Mute read aloud">&#x1F50A;</button>`;
    player.addEventListener('click', (event) => {
      const control = event.target.closest('[data-tts-control]');
      if (!control) return;
      event.preventDefault();
      event.stopPropagation();
      const action = control.dataset.ttsControl;
      if (action === 'pause') togglePause();
      else if (action === 'stop') stop();
      else if (action === 'previous') jump(-1);
      else if (action === 'next') jump(1);
      else if (action === 'volume') {
        speechVolume = speechVolume ? 0 : 1;
        restartCurrent();
      }
    });
    player.querySelector('[data-tts-control="rate"]').addEventListener('change', (event) => {
      speechRate = Number(event.target.value) || 1;
      restartCurrent();
    });
    document.body.append(player);
    updatePlayer();
    return player;
  }

  function updatePlayer() {
    if (!player?.isConnected) return;
    const pauseButton = player.querySelector('[data-tts-control="pause"]');
    pauseButton.innerHTML = paused ? '&#x25B6;' : '&#x23F8;';
    pauseButton.setAttribute('aria-label', paused ? 'Resume read aloud' : 'Pause read aloud');
    const volumeButton = player.querySelector('[data-tts-control="volume"]');
    volumeButton.innerHTML = speechVolume ? '&#x1F50A;' : '&#x1F507;';
    volumeButton.setAttribute('aria-label', speechVolume ? 'Mute read aloud' : 'Unmute read aloud');
    player.hidden = !playing;
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
    const entry = queue[queueIndex++];
    if (entry.pause) {
      window.setTimeout(playNext, 650);
      return;
    }
    setHighlight(entry.element);
    const utterance = new Utterance(entry.text);
    const generation = playbackGeneration;
    const voice = sessionVoice;
    utterance.lang = voice?.lang || ENGLISH_LANG;
    if (voice) utterance.voice = voice;
    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.volume = speechVolume;
    showWordHighlight(entry.wordMap?.[0] ?? entry.wordOffset ?? 0);
    utterance.onboundary = (event) => {
      if (generation !== playbackGeneration || event.name !== 'word') return;
      const wordsBefore = utterance.text.slice(0, event.charIndex).trim().split(/\s+/).filter(Boolean).length;
      const sourceWordIndex = entry.wordMap?.[wordsBefore];
      showWordHighlight(Number.isInteger(sourceWordIndex) ? sourceWordIndex : (entry.wordOffset || 0) + wordsBefore);
    };
    utterance.onend = () => {
      if (generation === playbackGeneration && !cancelled) window.setTimeout(playNext, 30);
    };
    utterance.onerror = (event) => {
      // "interrupted" is expected when Stop is pressed; other failures should
      // not prevent the rest of the page from being read.
      if (generation === playbackGeneration && !cancelled && event.error !== 'interrupted' && event.error !== 'canceled') window.setTimeout(playNext, 30);
    };
    synth.speak(utterance);
  }

  function restartAt(index) {
    if (!playing || !queue.length) return;
    playbackGeneration += 1;
    synth.cancel();
    paused = false;
    queueIndex = Math.max(0, Math.min(index, queue.length - 1));
    updatePlayer();
    window.setTimeout(playNext, 40);
  }

  function restartCurrent() {
    restartAt(Math.max(0, queueIndex - 1));
  }

  function jump(direction) {
    const current = Math.max(0, queueIndex - 1);
    restartAt(current + direction);
  }

  function togglePause() {
    if (!playing) return;
    if (paused) synth.resume();
    else synth.pause();
    paused = !paused;
    updatePlayer();
  }

  function start() {
    if (!canUseWebSpeech) return;
    suppressBundledAudio = true;
    stopBundledAudio();
    synth.cancel();
    sessionVoice = preferredVoice();
    cancelled = false;
    queue = collectNarrationQueue();
    if (!queue.length) return;
    queueIndex = 0;
    playing = true;
    paused = false;
    playbackGeneration += 1;
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
    ensurePlayer();
    updatePlayer();
    playNext();
  }

  function stop() {
    cancelled = true;
    playbackGeneration += 1;
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
    if (control?.closest('.adt-accessible-tts-player')) return;
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
    if (control?.closest('.adt-accessible-tts-player')) return;
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
    mathText,
    sanitizeForSpeech,
    splitIntoChunks,
    collectNarrationQueue,
    spokenToSourceWordMap,
    start,
    stop,
    toggle: () => (playing ? stop() : start()),
    get isPlaying() { return playing; }
  });

  if (canUseWebSpeech && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', preferredVoice);
  }
})();
