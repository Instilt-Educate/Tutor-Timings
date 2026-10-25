/**
 * Normalize a string for matching: remove diacritics, remove non-alphanumerics,
 * collapse whitespace and lowercase
 */
export function normalizeForMatch(input) {
  if (!input) return '';
  const noDiacritics = input.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return noDiacritics.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Strip emojis and other non-standard characters from a string
 */
export function stripEmojis(str) {
  if (!str) return '';
  return str
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Misc Symbols and Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Transport and Map
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Flags
    .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Dingbats
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '') // Supplemental Symbols and Pictographs
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '') // Chess Symbols
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '') // Symbols and Pictographs Extended-A
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')   // Variation Selectors
    .replace(/[\u{200D}]/gu, '')            // Zero Width Joiner
    .trim();
}
