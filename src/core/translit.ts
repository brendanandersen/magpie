/**
 * Rough romanization of non-Latin reflex forms (Cyrillic, Greek, Devanagari) into
 * Latin letters, so the lexical-fidelity scorer can compare a target language's real
 * words against our romanized PIE-derived output (see language-match.computeLexical).
 *
 * This is deliberately approximate: it aims for good fuzzy-match closeness under
 * Levenshtein, not scholarly ISO 15919 / scientific transliteration. Diacritics in the
 * output are fine — downstream normalizeAncestor() strips them to [a-z]. Latin-script
 * input (German/French/Icelandic) is returned unchanged.
 */

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

const GREEK: Record<string, string> = {
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i',
  κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's',
  ς: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'kh', ψ: 'ps', ω: 'o',
};

// Devanagari consonants (inherent /a/ is added by the syllable logic below).
const DEVA_CONS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh',
  ञ: 'n', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd',
  ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r',
  ल: 'l', व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h',
};
const DEVA_IVOWEL: Record<string, string> = {
  अ: 'a', आ: 'a', इ: 'i', ई: 'i', उ: 'u', ऊ: 'u', ऋ: 'r', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au',
};
// Dependent vowel signs (matras) that replace a consonant's inherent /a/.
const DEVA_MATRA: Record<string, string> = {
  '\u093e': 'a', '\u093f': 'i', '\u0940': 'i', '\u0941': 'u', '\u0942': 'u',
  '\u0943': 'r', '\u0947': 'e', '\u0948': 'ai', '\u094b': 'o', '\u094c': 'au',
};
const DEVA_VIRAMA = '\u094d';
const DEVA_SIGN: Record<string, string> = {
  '\u0902': 'm', // anusvara
  '\u0903': 'h', // visarga
  '\u0901': 'n', // candrabindu
};

function translitTable(s: string, table: Record<string, string>): string {
  let out = '';
  for (const ch of s.normalize('NFD')) {
    if (/[\u0300-\u036f]/.test(ch)) continue; // combining marks
    const mapped = table[ch.toLowerCase()];
    out += mapped ?? (/[a-z]/i.test(ch) ? ch : '');
  }
  return out.toLowerCase();
}

function translitGreek(s: string): string {
  // Rough breathing (U+0314) marks an /h/ onset; capture it before stripping marks.
  const h = /\u0314/.test(s.normalize('NFD')) ? 'h' : '';
  return h + translitTable(s, GREEK);
}

function translitDevanagari(s: string): string {
  const chars = [...s.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const cons = DEVA_CONS[c];
    if (cons !== undefined) {
      out += cons;
      const next = chars[i + 1];
      if (next === DEVA_VIRAMA) i++; // no inherent vowel
      else if (next !== undefined && DEVA_MATRA[next] !== undefined) {
        out += DEVA_MATRA[next];
        i++;
      } else out += 'a'; // inherent vowel
      continue;
    }
    if (DEVA_IVOWEL[c] !== undefined) out += DEVA_IVOWEL[c];
    else if (DEVA_SIGN[c] !== undefined) out += DEVA_SIGN[c];
    // else: danda, digits, ZWJ, etc. — skip
  }
  return out;
}

/** Romanize a reflex form; Latin-script input is returned unchanged. */
export function transliterate(form: string): string {
  const s = form.normalize('NFC');
  if (/[\u0400-\u04ff]/.test(s)) return translitTable(s, CYRILLIC);
  if (/[\u0370-\u03ff\u1f00-\u1fff]/.test(s)) return translitGreek(s);
  if (/[\u0900-\u097f]/.test(s)) return translitDevanagari(s);
  return form;
}
