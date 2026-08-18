const assert = require('node:assert/strict');

class FakeElement {
  constructor(tagName, text = '', children = []) {
    this.tagName = tagName;
    this.textContent = text;
    this.children = children;
    this.childNodes = children;
    this.nodeType = 1;
    this.dataset = {};
    this.classList = { contains: () => false };
  }
  matches() { return false; }
  querySelector() { return null; }
  getAttribute() { return null; }
}

class FakeText {
  constructor(value) {
    this.nodeType = 3;
    this.nodeValue = value;
  }
}

global.Element = FakeElement;
global.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
global.HTMLAudioElement = class {};
global.window = {
  speechSynthesis: null,
  SpeechSynthesisUtterance: null,
  HTMLMediaElement: null,
  Audio: null,
  addEventListener() {},
  setTimeout() {},
};
global.document = {};

require('../assets/accessible-tts.js');

const api = window.ADTAccessibleTTS;
assert.equal(api.speechRate, 0.85);
assert.equal(api.setSpeechRate(0.38), 0.38);
assert.equal(api.setSpeechRate(1.8), 1.8);
assert.equal(api.setSpeechRate(0.85), 0.85);
assert.equal(api.sanitizeForSpeech('1/3'), 'one over three');
assert.equal(api.sanitizeForSpeech('35/40'), 'thirty-five over forty');
assert.equal(api.sanitizeForSpeech('36 ÷ 4'), 'thirty-six divided by four');
assert.equal(api.sanitizeForSpeech('4 ⟌ 36'), 'thirty-six divided by four');
assert.equal(
  api.sanitizeForSpeech('shs 869335 30 cts − shs 427123 70 cts'),
  'shillings eight hundred and sixty-nine thousand three hundred and thirty-five thirty cents minus shillings four hundred and twenty-seven thousand one hundred and twenty-three seventy cents'
);
const mathFraction = new FakeElement('MFRAC', '', [
  new FakeElement('MN', '3'),
  new FakeElement('MN', '4'),
]);
assert.equal(api.mathText(mathFraction), '3 over 4');
const fractionSentence = new FakeElement('SPAN', '', [
  new FakeText('The shaded part is '),
  mathFraction,
  new FakeText('.'),
]);
assert.equal(api.fractionAwareText(fractionSentence).replace(/\s+/g, ' ').trim(), 'The shaded part is 3 over 4 .');
assert.deepEqual(api.spokenTokenParts('twenty-four shillings'), ['twenty', 'four', 'shillings']);
assert.deepEqual(api.spokenTokenParts("five o'clock"), ['five', "o'clock"]);
assert.deepEqual(api.splitIntoLanguageChunks('Editors. [[adt_lang:sw-TZ]] Furaha Chuma [[adt_lang:end]] Designer.'), [
  { pause: false, text: 'Editors.', lang: 'en-US' },
  { pause: false, text: 'Furaha Chuma', lang: 'sw-TZ' },
  { pause: false, text: 'Designer.', lang: 'en-US' },
]);
assert.deepEqual(
  api.alignTokenSequences(
    ['one', 'image', 'description', 'then', 'two'],
    ['one', 'then', 'two']
  ),
  [0, -1, -1, 1, 2]
);

console.log('Fraction narration tests passed.');
