// English-only shim replacing OpenWhispr's i18nMain.js.
// ChemistCare-Offline does not port OpenWhispr's i18n system; only the
// handful of strings used by transcriptFormatter.js are provided here.
const STRINGS = {
  "transcript.speaker.you": "Speaker 1",
  "transcript.speaker.others": "Speaker 2",
  "notes.editor.participants": "Participants",
};

const i18nMain = {
  language: "en",
  t(key) {
    return STRINGS[key] || key;
  },
  async changeLanguage() {},
  getLanguage() {
    return "en";
  },
};

function normalizeUiLanguage() {
  return "en";
}

module.exports = { i18nMain, normalizeUiLanguage };
