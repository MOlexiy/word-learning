/** Шматок тексту для окремого SpeechSynthesisUtterance та його зсув у повному тексті. */
export interface SpeechChunk {
  text: string;
  offset: number;
}

/**
 * Chrome обриває озвучку довгого utterance (~15 с) для мережевих голосів Google,
 * тому довгий текст ділимо на речення, а надто довгі речення — по пробілах.
 */
const MAX_CHUNK = 220;

export function splitIntoSpeechChunks(text: string): SpeechChunk[] {
  const chunks: SpeechChunk[] = [];
  for (const sentence of splitSentences(text)) {
    let { text: rest, offset } = sentence;
    while (rest.length > MAX_CHUNK) {
      const cut = findCut(rest);
      pushTrimmed(chunks, rest.slice(0, cut), offset);
      rest = rest.slice(cut);
      offset += cut;
    }
    pushTrimmed(chunks, rest, offset);
  }
  return chunks;
}

/** Довжина слова, що починається з `index` (коли браузер не повідомляє charLength). */
export function wordLengthAt(text: string, index: number): number {
  const match = /^[\p{L}\p{N}'’-]+/u.exec(text.slice(index));
  return match ? match[0].length : 1;
}

function splitSentences(text: string): SpeechChunk[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    return Array.from(segmenter.segment(text), (s) => ({ text: s.segment, offset: s.index }));
  }
  const result: SpeechChunk[] = [];
  for (const match of text.matchAll(/[^.!?]+(?:[.!?]+|$)\s*/g)) {
    result.push({ text: match[0], offset: match.index ?? 0 });
  }
  return result.length ? result : [{ text, offset: 0 }];
}

function findCut(text: string): number {
  const window = text.slice(0, MAX_CHUNK);
  const punctuation = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '));
  if (punctuation > MAX_CHUNK / 2) return punctuation + 2;
  const space = window.lastIndexOf(' ');
  return space > 0 ? space + 1 : MAX_CHUNK;
}

function pushTrimmed(chunks: SpeechChunk[], raw: string, offset: number): void {
  const lead = raw.length - raw.trimStart().length;
  const text = raw.trim();
  if (text) chunks.push({ text, offset: offset + lead });
}
