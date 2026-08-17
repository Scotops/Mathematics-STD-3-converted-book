const assert = require('node:assert/strict');

class FakeElement {
  constructor(tagName, text = '', children = []) {
    this.tagName = tagName;
    this.textContent = text;
    this.children = children;
    this.classList = { contains: () => false };
  }
  querySelector() { return null; }
  getAttribute() { return null; }
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
assert.equal(api.sanitizeForSpeech('1/3'), 'one over three');
assert.equal(api.sanitizeForSpeech('35/40'), 'thirty-five over forty');
const mathFraction = new FakeElement('MFRAC', '', [
  new FakeElement('MN', '3'),
  new FakeElement('MN', '4'),
]);
assert.equal(api.mathText(mathFraction), '3 over 4');
assert.deepEqual(api.spokenTokenParts('twenty-four shillings'), ['twenty', 'four', 'shillings']);
assert.deepEqual(api.spokenTokenParts("five o'clock"), ['five', "o'clock"]);
assert.deepEqual(
  api.alignTokenSequences(
    ['one', 'image', 'description', 'then', 'two'],
    ['one', 'then', 'two']
  ),
  [0, -1, -1, 1, 2]
);

console.log('Fraction narration tests passed.');
