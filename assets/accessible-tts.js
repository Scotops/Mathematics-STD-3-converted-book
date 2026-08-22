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
  // Match the calmer pace used by the Cultural book. The learner can still
  // change this from the playback panel without changing the page content.
  // Keep the presets deliberately far apart. Some Windows voices compress
  // nearby Web Speech rates, which made the old choices sound identical.
  const SPEECH_RATES = Object.freeze({ slow: 0.38, normal: 0.85, fast: 1.8 });
  const storedSpeechRate = Number.parseFloat(window.localStorage?.getItem('adt-reading-speed') || '');
  let speechRate = Object.values(SPEECH_RATES).includes(storedSpeechRate)
    ? storedSpeechRate
    : SPEECH_RATES.normal;
  let speechVolume = 1;
  let activeUtterance = null;
  let playbackGeneration = 0;
  let currentChunkIndex = -1;
  let rateRestartTimer = null;
  let wordHighlightMap = [];
  let pendingHighlightFrame = null;
  let wordHighlightOverlay = null;
  let player = null;
  let autoplayStarted = false;
  let manualScrollPauseUntil = 0;
  let programmaticScrollUntil = 0;
  const trackedAudio = new Set();

  function installPresentationStyles() {
    if (document.getElementById('adt-accessible-tts-styles')) return;
    const style = document.createElement('style');
    style.id = 'adt-accessible-tts-styles';
    style.textContent = `
      ::highlight(adt-tts-word) { background: #ffe45c; color: #111; }
      .adt-tts-word-overlay {
        position: fixed; z-index: 2147482998; display: none;
        pointer-events: none; border-radius: 4px;
        background: rgba(255, 228, 92, .78);
        box-shadow: 0 0 0 2px rgba(255, 193, 7, .18);
      }
      .adt-accessible-tts-player {
        position: fixed; right: 22px; bottom: 88px; z-index: 2147483000;
        display: flex; align-items: center; gap: 10px; padding: 10px 14px;
        color: #fff; background: #262626; border-radius: 15px;
        box-shadow: 0 8px 24px rgba(0,0,0,.28); font: 600 15px/1.2 system-ui,sans-serif;
      }
      .adt-accessible-tts-player button,
      .adt-accessible-tts-player select {
        min-width: 42px; min-height: 42px; border: 1px solid #777; border-radius: 10px;
        color: #fff; background: #333; font: inherit; cursor: pointer;
      }
      .adt-accessible-tts-player button:focus-visible,
      .adt-accessible-tts-player select:focus-visible { outline: 3px solid #ffe45c; outline-offset: 2px; }
      .adt-accessible-tts-player select { min-width: 92px; padding: 0 8px; }
      @media (max-width: 640px) {
        .adt-accessible-tts-player { left: 10px; right: 10px; bottom: 78px; justify-content: center; gap: 6px; }
        .adt-accessible-tts-player button { min-width: 38px; }
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePlayer() {
    if (player?.isConnected) return player;
    installPresentationStyles();
    player = document.createElement('div');
    player.className = 'adt-accessible-tts-player';
    player.setAttribute('role', 'group');
    player.setAttribute('aria-label', 'Read aloud controls');
    player.innerHTML = `
      <button type="button" data-tts-command="previous" aria-label="Previous spoken part">&#9198;</button>
      <button type="button" data-tts-command="pause" aria-label="Pause reading">&#10074;&#10074;</button>
      <button type="button" data-tts-command="next" aria-label="Next spoken part">&#9197;</button>
      <button type="button" data-tts-command="stop" aria-label="Stop reading">&#9632;</button>
      <label><span class="sr-only">Reading speed</span><select data-tts-command="rate" aria-label="Reading speed">
        <option value="0.38">Slow</option><option value="0.85">Normal</option><option value="1.8">Fast</option>
      </select></label>
      <button type="button" data-tts-command="volume" aria-label="Mute or unmute reading">&#128266;</button>
    `;
    player.addEventListener('click', (event) => {
      const command = event.target.closest('[data-tts-command]')?.dataset.ttsCommand;
      if (!command || command === 'rate') return;
      event.preventDefault(); event.stopPropagation();
      if (command === 'pause') togglePause();
      if (command === 'stop') stop();
      if (command === 'previous') jump(-1);
      if (command === 'next') jump(1);
      if (command === 'volume') {
        speechVolume = speechVolume ? 0 : 1;
        event.target.innerHTML = speechVolume ? '&#128266;' : '&#128263;';
        restartCurrent();
      }
    });
    const rateControl = player.querySelector('[data-tts-command="rate"]');
    const handleRateChange = (event) => setSpeechRate(event.target.value);
    // `input` makes touch and keyboard changes immediate; `change` is retained
    // for browsers that only emit it when the menu closes.
    rateControl.addEventListener('input', handleRateChange);
    rateControl.addEventListener('change', handleRateChange);
    document.body.appendChild(player);
    const selectedRate = player.querySelector('[data-tts-command="rate"]');
    selectedRate.value = String(speechRate);
    player.dataset.activeRate = String(speechRate);
    document.documentElement.dataset.adtTtsRate = String(speechRate);
    updatePlayer();
    return player;
  }

  function updatePlayer() {
    if (!player) return;
    const pauseButton = player.querySelector('[data-tts-command="pause"]');
    pauseButton.innerHTML = !playing || paused ? '&#9654;' : '&#10074;&#10074;';
    pauseButton.setAttribute('aria-label', !playing ? 'Start reading' : (paused ? 'Resume reading' : 'Pause reading'));
  }

  function setSpeechRate(value) {
    const requestedRate = Number(value);
    const nextRate = Object.values(SPEECH_RATES).includes(requestedRate)
      ? requestedRate
      : SPEECH_RATES.normal;
    speechRate = nextRate;
    try { window.localStorage?.setItem('adt-reading-speed', String(speechRate)); } catch {}
    if (document.documentElement) document.documentElement.dataset.adtTtsRate = String(speechRate);
    if (player) {
      player.dataset.activeRate = String(speechRate);
      player.querySelector('[data-tts-command="rate"]').value = String(speechRate);
    }
    // A speed choice must have an audible result. If narration is active,
    // replay the current spoken part at the new rate. If it has finished (or
    // was stopped), begin the page immediately at the selected rate.
    if (playing) restartCurrent();
    else if (canUseWebSpeech) start();
    return speechRate;
  }

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

  function fractionAwareText(node) {
    if (node?.nodeType === Node.TEXT_NODE) return String(node.nodeValue || '');
    if (!(node instanceof Element)) return '';
    if (node.dataset?.ttsText) return node.dataset.ttsText;
    if (node.matches?.('input, textarea, select')) return fieldText(node);
    if (node.tagName === 'IMG') return node.getAttribute('alt') || '';
    if (node.tagName === 'MATH' || node.tagName === 'MFRAC'
      || node.tagName === 'MJX-MFRAC' || node.classList.contains('mjx-mfrac')) {
      return mathText(node);
    }
    return [...node.childNodes].map(fractionAwareText).filter(Boolean).join(' ');
  }

  function extractPageText() {
    const root = document.querySelector('#content') || document.body;
    const pieces = [];
    const add = (value) => {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      if (text) pieces.push(text);
    };
    const boundary = () => pieces.push('. ');

    function numberedItemKind(element) {
      const scope = element.closest('section, article') || root;
      const labels = scope.querySelectorAll('h1, h2, h3, h4, h5, h6, [data-id], strong');
      let lastContext = '';
      for (const label of labels) {
        if (label === element || label.contains(element)) continue;
        const position = label.compareDocumentPosition(element);
        if (!(position & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
        const text = String(label.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^steps?:?$/i.test(text)) lastContext = 'step';
        else if (/^(?:exercise|revision exercise|questions?|activity)\b/i.test(text)) lastContext = 'question';
      }
      return lastContext === 'step' ? 'Step' : 'Question';
    }

    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        add(node.nodeValue);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const element = node;
      if (ignoredTags.has(element.tagName) || !isVisible(element)) return;

      const spokenLanguage = element.dataset.ttsLang || element.getAttribute('lang');
      if (spokenLanguage && !/^en(?:-|$)/i.test(spokenLanguage)) {
        add(`[[adt_lang:${spokenLanguage}]] ${fractionAwareText(element)} [[adt_lang:end]]`);
        return;
      }

      if (element.dataset.ttsText) {
        add(element.dataset.ttsText);
        return;
      }

      // Treat a localized text block containing MathML as one semantic unit.
      // MathJax can visually replace or hide the source fraction, which made
      // the ordinary DOM walk keep the surrounding sentence but omit the
      // numerator and denominator. Reading the whole data-id block here keeps
      // every fraction explicit: "numerator over denominator".
      if (element.hasAttribute('data-id')
        && element.querySelector('mfrac, [aria-roledescription="fraction"], mjx-mfrac, .mjx-mfrac')) {
        add(fractionAwareText(element));
        return;
      }

      // Exercise question numbers need their own spoken beat. The pause token
      // is handled by the playback queue and is never sent to the voice.
      const visibleText = String(element.textContent || '').trim();
      if (element.tagName === 'SPAN' && /^\d+\.$/.test(visibleText)) {
        add(`${numberedItemKind(element)} ${visibleText} [[adt_pause]]`);
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
      // Identifiers and contact details use punctuation as separators, not as
      // mathematical operators. Expand them before the generic maths rules.
      .replace(/\bISBN\s*:\s*([0-9-]+)/gi, (_, value) => {
        const spoken = [...value].map((char) => char === '-' ? ' dash ' : ` ${char} `).join('');
        return ` ISBN, ${spoken} `;
      })
      .replace(/(\+?\d[\d ]{6,})\s*\/\s*(\+?\d[\d ]{6,})/g, '$1, or, $2')
      .replace(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+)\b/gi, (_, value) => {
        return ` ${value.replace(/\./g, ' dot ')} `;
      })
      // Item markers must be spoken as English letters, without parentheses.
      .replace(/\(\s*([a-z])\s*\)/gi, (_, letter) => ` ${letter.toUpperCase()}, `)
      // Currency abbreviations are printed throughout the final chapter. Speak
      // their meanings so column headings and calculations remain intelligible.
      .replace(/\bshs?\.?\b/gi, ' shillings ')
      .replace(/\b(?:cts?|cst)\.?\b/gi, ' cents ')
      // Underlines and empty inputs are the blanks printed in the original book.
      .replace(/\[\[\s*blank(?::[^\]]*)?\s*\]\]/gi, ' dash ')
      .replace(/__adt_empty_field__/g, ' dash ')
      .replace(/_{2,}/g, ' dash ')
      .replace(/≤/g, ' less than or equal to ')
      .replace(/≥/g, ' greater than or equal to ')
      .replace(/≠/g, ' not equal to ')
      // Mathematical division must be announced as an operation. Fractions
      // using a slash are handled separately below as numerator "over"
      // denominator.
      // In long-division notation the divisor is printed to the left of the
      // bracket, so "4 ⟌ 36" is spoken as "36 divided by 4".
      .replace(/(\d[\d,]*)\s*⟌\s*(\d[\d,]*)/g, '$2 divided by $1')
      .replace(/÷|∕|⟌/g, ' divided by ')
      .replace(/[×✕]/g, ' times ')
      .replace(/\+/g, ' plus ')
      .replace(/=/g, ' equals ')
      .replace(/(\d)\s*-\s*(\d)/g, '$1 minus $2')
      // Numeric slashes in this chapter are fractions, not division signs.
      .replace(/(\d[\d,]*)\s*\/\s*(\d[\d,]*)/g, '$1 over $2')
      .replace(/\//g, ' divided by ')
      .replace(/(\d)\s*[−–—-]\s*(\d)/g, '$1 minus $2')
      .replace(/[−–—]/g, ' minus ')
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

  function splitIntoLanguageChunks(markedText) {
    const chunks = [];
    let language = ENGLISH_LANG;
    String(markedText || '').split(/(\[\[adt_lang:[^\]]+\]\])/gi).forEach((part) => {
      const marker = part.match(/^\[\[adt_lang:([^\]]+)\]\]$/i);
      if (marker) {
        language = marker[1].toLowerCase() === 'end' ? ENGLISH_LANG : marker[1];
        return;
      }
      splitIntoChunks(part).forEach((chunk) => {
        chunks.push(chunk === '__adt_speech_pause__'
          ? { pause: true, text: '', lang: language }
          : { pause: false, text: chunk, lang: language });
      });
    });
    return chunks;
  }

  function normalizedWord(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  // SpeechSynthesis reports a boundary for each spoken component. For
  // example, "twenty-four" produces boundaries for "twenty" and "four".
  // Counting whitespace-separated strings made every later highlight drift
  // by one word. Use the same boundary-sized tokens for mapping, queue
  // offsets and boundary events.
  function spokenTokenParts(value) {
    return String(value || '').match(/[A-Za-z0-9]+(?:'[A-Za-z0-9]+)?/g) || [];
  }

  function visibleWordRanges() {
    const root = document.querySelector('#content') || document.body;
    const ranges = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ignoredTags.has(parent.tagName) || !isVisible(parent) || !node.nodeValue.trim()) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const matcher = /\S+/g;
      let match;
      while ((match = matcher.exec(node.nodeValue))) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        ranges.push({ range, text: match[0] });
      }
    }
    return ranges;
  }

  function alignTokenSequences(spokenWords, printedWords) {
    const rows = Array.from({ length: spokenWords.length + 1 }, () => new Uint16Array(printedWords.length + 1));
    for (let spokenIndex = 1; spokenIndex <= spokenWords.length; spokenIndex += 1) {
      const row = rows[spokenIndex];
      const previous = rows[spokenIndex - 1];
      for (let printedIndex = 1; printedIndex <= printedWords.length; printedIndex += 1) {
        row[printedIndex] = spokenWords[spokenIndex - 1] === printedWords[printedIndex - 1]
          ? previous[printedIndex - 1] + 1
          : Math.max(previous[printedIndex], row[printedIndex - 1]);
      }
    }
    const alignment = Array(spokenWords.length).fill(-1);
    let spokenIndex = spokenWords.length;
    let printedIndex = printedWords.length;
    while (spokenIndex > 0 && printedIndex > 0) {
      if (spokenWords[spokenIndex - 1] === printedWords[printedIndex - 1]) {
        alignment[spokenIndex - 1] = printedIndex - 1;
        spokenIndex -= 1;
        printedIndex -= 1;
      } else if (rows[spokenIndex - 1][printedIndex] >= rows[spokenIndex][printedIndex - 1]) {
        spokenIndex -= 1;
      } else {
        printedIndex -= 1;
      }
    }
    return alignment;
  }

  // Build a non-invasive map from each spoken word back to the printed word.
  // The narration text itself is never changed: this only lets the yellow
  // marker follow speech without wrapping or rewriting textbook content.
  function buildWordHighlightMap(spokenText) {
    const printed = visibleWordRanges();
    const expandedPrinted = [];
    printed.forEach((item, printedIndex) => {
      spokenTokenParts(sanitizeForSpeech(item.text)).forEach((word) => {
        const normalized = normalizedWord(word);
        if (normalized) expandedPrinted.push({ normalized, printedIndex });
      });
    });
    const spokenWords = spokenTokenParts(spokenText).map(normalizedWord);
    const printedWords = expandedPrinted.map((item) => item.normalized);
    // Longest-common-subsequence alignment keeps the visible and spoken word
    // streams synchronized even when narration contains image descriptions,
    // input blanks, accessibility labels, or other words with no printed
    // range. A greedy look-ahead loses its place after those passages.
    return alignTokenSequences(spokenWords, printedWords).map((match) => match < 0
      ? null
      : printed[expandedPrinted[match].printedIndex].range);
  }

  function ensureWordHighlightOverlay() {
    if (wordHighlightOverlay?.isConnected) return wordHighlightOverlay;
    wordHighlightOverlay = document.createElement('div');
    wordHighlightOverlay.className = 'adt-tts-word-overlay';
    wordHighlightOverlay.setAttribute('aria-hidden', 'true');
    document.body.appendChild(wordHighlightOverlay);
    return wordHighlightOverlay;
  }

  function positionWordHighlightOverlay(range) {
    const overlay = ensureWordHighlightOverlay();
    const box = range.getBoundingClientRect();
    if (!box.width || !box.height) {
      overlay.style.display = 'none';
      return;
    }
    overlay.style.display = 'block';
    overlay.style.left = `${Math.max(0, box.left - 2)}px`;
    overlay.style.top = `${Math.max(0, box.top - 1)}px`;
    overlay.style.width = `${box.width + 4}px`;
    overlay.style.height = `${box.height + 2}px`;
  }

  function clearWordHighlight() {
    if (window.CSS?.highlights) CSS.highlights.delete('adt-tts-word');
    if (wordHighlightOverlay) wordHighlightOverlay.style.display = 'none';
    if (pendingHighlightFrame) {
      window.cancelAnimationFrame(pendingHighlightFrame);
      pendingHighlightFrame = null;
    }
  }

  function scrollRangeIntoReadingBand(range) {
    const element = range.startContainer.parentElement;
    if (!element || Date.now() < manualScrollPauseUntil) return;

    let scroller = element.parentElement;
    while (scroller && scroller !== document.body) {
      const style = getComputedStyle(scroller);
      if (/(auto|scroll)/.test(style.overflowY) && scroller.scrollHeight > scroller.clientHeight + 2) break;
      scroller = scroller.parentElement;
    }

    const box = range.getBoundingClientRect();
    const panelTop = player?.getBoundingClientRect().top || window.innerHeight;
    if (scroller && scroller !== document.body) {
      const viewport = scroller.getBoundingClientRect();
      const topLimit = viewport.top + 12;
      const bottomLimit = Math.min(viewport.bottom - 12, panelTop - 16);
      // Do not chase every word. Follow only after the current word has moved
      // completely outside the readable area, leaving manual scrolling alone.
      if (box.bottom < topLimit || box.top > bottomLimit) {
        const targetY = viewport.top + Math.min(viewport.height * 0.32, Math.max(80, bottomLimit - viewport.top - 90));
        programmaticScrollUntil = Date.now() + 350;
        scroller.scrollTop += box.top - targetY;
      }
      return;
    }

    const topLimit = 12;
    const bottomLimit = Math.max(topLimit + 100, panelTop - 16);
    if (box.bottom < topLimit || box.top > bottomLimit) {
      const targetY = Math.min(window.innerHeight * 0.32, bottomLimit - 90);
      const scrollingElement = document.scrollingElement || document.documentElement;
      programmaticScrollUntil = Date.now() + 350;
      scrollingElement.scrollTop += box.top - targetY;
    }
  }

  function showWordHighlight(index) {
    const range = wordHighlightMap[index];
    if (!range) return;
    const hasCssHighlight = window.CSS?.highlights && typeof Highlight === 'function';
    if (hasCssHighlight) {
      CSS.highlights.set('adt-tts-word', new Highlight(range));
      if (wordHighlightOverlay) wordHighlightOverlay.style.display = 'none';
    } else {
      positionWordHighlightOverlay(range);
    }
    if (pendingHighlightFrame) window.cancelAnimationFrame(pendingHighlightFrame);
    pendingHighlightFrame = window.requestAnimationFrame(() => {
      pendingHighlightFrame = null;
      scrollRangeIntoReadingBand(range);
      if (!hasCssHighlight) window.requestAnimationFrame(() => positionWordHighlightOverlay(range));
    });
  }

  // A learner must be able to move around a long page while it is being read.
  // Pause automatic following after deliberate wheel, touch, pointer or
  // navigation-key input; narration and word highlighting continue normally.
  const pauseAutoFollow = () => {
    if (Date.now() >= programmaticScrollUntil) manualScrollPauseUntil = Date.now() + 7000;
  };
  window.addEventListener('wheel', pauseAutoFollow, { passive: true, capture: true });
  window.addEventListener('touchstart', pauseAutoFollow, { passive: true, capture: true });
  window.addEventListener('pointerdown', pauseAutoFollow, { passive: true, capture: true });
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) pauseAutoFollow();
  }, true);

  function preferredVoice(language = ENGLISH_LANG) {
    if (!canUseWebSpeech || typeof synth.getVoices !== 'function') return null;
    const voices = synth.getVoices();
    const languageCode = String(language || ENGLISH_LANG).split(/[-_]/)[0];
    const matching = voices.filter((voice) => new RegExp(`^${languageCode}(?:[_-]|$)`, 'i').test(voice.lang));
    const pool = matching.length ? matching : (languageCode === 'en' ? voices : []);
    const score = (voice) => {
      const name = voice.name.toLowerCase();
      let value = 0;
      // Natural and neural voices are much warmer than the legacy desktop
      // voices and are easier for young learners to listen to for long pages.
      if (/natural|neural|premium|enhanced/.test(name)) value += 120;
      if (/microsoft (jenny|aria|sonia|ava|emma|michelle|natasha|serena)/.test(name)) value += 70;
      if (/google (us|uk) english.*female|samantha|karen|moira|tessa|victoria/.test(name)) value += 45;
      if (/female/.test(name)) value += 20;
      if (voice.localService) value += 8;
      // Avoid the older voices that commonly sound clipped or robotic.
      if (/microsoft (david|mark|zira|hazel)|desktop|legacy/.test(name)) value -= 80;
      return value;
    };
    return pool.sort((a, b) => score(b) - score(a))[0] || null;
  }

  function finish() {
    playbackGeneration += 1;
    playing = false;
    cancelled = false;
    queue = [];
    queueIndex = 0;
    currentChunkIndex = -1;
    activeUtterance = null;
    paused = false;
    wordHighlightMap = [];
    clearWordHighlight();
    if (keepAliveTimer) {
      window.clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    document.documentElement.classList.remove('adt-tts-playing');
    updatePlayer();
  }

  function stopBundledAudio() {
    const allAudio = new Set([...trackedAudio, ...document.querySelectorAll('audio')]);
    allAudio.forEach((audio) => {
      audio.pause();
      try { audio.currentTime = 0; } catch {}
    });
  }

  function playNext(generation = playbackGeneration) {
    if (generation !== playbackGeneration) return;
    if (cancelled || queueIndex >= queue.length) return finish();
    currentChunkIndex = queueIndex;
    const nextChunk = queue[queueIndex++];
    if (nextChunk.pause) {
      window.setTimeout(() => playNext(generation), 650);
      return;
    }
    const utterance = new Utterance(nextChunk.text);
    activeUtterance = utterance;
    const requestedLanguage = nextChunk.lang || ENGLISH_LANG;
    const voice = requestedLanguage === ENGLISH_LANG ? sessionVoice : preferredVoice(requestedLanguage);
    utterance.lang = voice?.lang || requestedLanguage;
    if (voice) utterance.voice = voice;
    utterance.rate = speechRate;
    if (player) player.dataset.utteranceRate = String(utterance.rate);
    utterance.volume = speechVolume;
    utterance.pitch = 1;
    utterance.onstart = () => showWordHighlight(nextChunk.wordOffset);
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word') return;
      const wordsBefore = spokenTokenParts(utterance.text.slice(0, event.charIndex)).length;
      showWordHighlight(nextChunk.wordOffset + wordsBefore);
    };
    utterance.onend = () => {
      // This pause is a second, engine-independent speed control. It keeps
      // the presets distinct even when an installed voice only partially
      // honours SpeechSynthesisUtterance.rate.
      const transitionDelay = speechRate <= SPEECH_RATES.slow
        ? 320
        : (speechRate >= SPEECH_RATES.fast ? 0 : 55);
      if (generation === playbackGeneration) window.setTimeout(() => playNext(generation), transitionDelay);
    };
    utterance.onerror = (event) => {
      // "interrupted" is expected when Stop is pressed; other failures should
      // not prevent the rest of the page from being read.
      if (generation === playbackGeneration && !cancelled && event.error !== 'interrupted' && event.error !== 'canceled') {
        window.setTimeout(() => playNext(generation), 30);
      }
    };
    synth.speak(utterance);
  }

  function start() {
    const markedText = sanitizeForSpeech(extractPageText());
    const text = markedText.replace(/\[\[adt_lang:[^\]]+\]\]/gi, ' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (!canUseWebSpeech) return;
    suppressBundledAudio = true;
    stopBundledAudio();
    synth.cancel();
    playbackGeneration += 1;
    sessionVoice = preferredVoice();
    document.documentElement.dataset.adtTtsVoice = sessionVoice?.name || 'browser default';
    cancelled = false;
    wordHighlightMap = buildWordHighlightMap(text);
    let wordOffset = 0;
    queue = splitIntoLanguageChunks(markedText, wordOffset).map((chunk) => {
      if (chunk.pause) return { pause: true, wordOffset, lang: chunk.lang };
      const entry = { text: chunk.text, wordOffset, lang: chunk.lang };
      wordOffset += spokenTokenParts(chunk.text).length;
      return entry;
    });
    queueIndex = 0;
    playing = true;
    paused = false;
    document.documentElement.dataset.adtTtsStarted = 'true';
    ensurePlayer();
    updatePlayer();
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
    playNext(playbackGeneration);
  }

  function stop() {
    cancelled = true;
    playbackGeneration += 1;
    if (canUseWebSpeech) synth.cancel();
    suppressBundledAudio = canUseWebSpeech;
    finish();
  }

  function togglePause() {
    if (!playing) return start();
    if (paused) synth.resume(); else synth.pause();
    paused = !paused;
    updatePlayer();
  }

  function jump(delta) {
    if (!queue.length) return;
    const target = Math.max(0, Math.min(queue.length - 1, currentChunkIndex + delta));
    synth.cancel();
    playbackGeneration += 1;
    cancelled = false;
    paused = false;
    queueIndex = target;
    const generation = playbackGeneration;
    window.setTimeout(() => playNext(generation), 30);
    updatePlayer();
  }

  function restartCurrent() {
    if (!playing || currentChunkIndex < 0) return;
    if (rateRestartTimer) window.clearTimeout(rateRestartTimer);
    playbackGeneration += 1;
    const generation = playbackGeneration;
    const restartIndex = currentChunkIndex;
    cancelled = false;
    paused = false;
    activeUtterance = null;
    synth.cancel();
    // Chromium cancels Web Speech asynchronously. Starting the replacement
    // utterance too soon can make it keep the old rate or silently discard it.
    // Give cancellation time to settle, then restart the same spoken part.
    rateRestartTimer = window.setTimeout(() => {
      rateRestartTimer = null;
      if (generation !== playbackGeneration || cancelled) return;
      queueIndex = restartIndex;
      playNext(generation);
    }, 260);
    updatePlayer();
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
    fractionAwareText,
    sanitizeForSpeech,
    alignTokenSequences,
    spokenTokenParts,
    splitIntoChunks,
    splitIntoLanguageChunks,
    setSpeechRate,
    start,
    stop,
    pause: togglePause,
    toggle: () => (playing ? stop() : start()),
    get speechRate() { return speechRate; },
    get isPlaying() { return playing; }
  });

  if (canUseWebSpeech && typeof synth.addEventListener === 'function') {
    synth.addEventListener('voiceschanged', preferredVoice);
  }

  // The ADT fades page content in after its interface has loaded. Start the
  // unchanged full-page narrator as soon as that content is actually visible,
  // while retaining the speaker button and playback panel for manual control.
  function scheduleAutoplay(attempt = 0) {
    if (!canUseWebSpeech || autoplayStarted || playing) return;
    // Matrix corrections require these content pages to wait for the learner
    // to press Play instead of beginning narration automatically.
    if (/\/pg0(?:23|25|26)_sec001\.html$/i.test(window.location.pathname)) return;
    const root = document.querySelector('#content');
    const ready = root && isVisible(root) && Number.parseFloat(getComputedStyle(root).opacity || '1') > 0.05
      && String(root.innerText || '').trim();
    if (ready) {
      autoplayStarted = true;
      ensurePlayer();
      start();
      return;
    }
    if (attempt < 60) window.setTimeout(() => scheduleAutoplay(attempt + 1), 100);
  }

  const beginAutoplay = () => window.setTimeout(() => scheduleAutoplay(), 250);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', beginAutoplay, { once: true });
  else beginAutoplay();
  window.addEventListener('pageshow', beginAutoplay, { once: true });
})();
