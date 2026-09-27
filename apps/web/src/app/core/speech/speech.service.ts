import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter } from 'rxjs';
import { BrowserStorage } from '../browser/browser-storage';
import { splitIntoSpeechChunks, wordLengthAt } from './speech-text';

export type SpeechAccent = 'en-US' | 'en-GB';
export type SpeechRate = 1 | 0.75;

/** Слово, яке зараз вимовляється: зсуви в повному тексті (для підсвітки). */
export interface SpokenWord {
  key: string;
  start: number;
  end: number;
}

const ACCENT_KEY = 'wl.speech.accent';
const RATE_KEY = 'wl.speech.rate';

/**
 * Озвучка англійського тексту через вбудований у браузер Web Speech API (speechSynthesis):
 * без сторонніх сервісів, ключів і обмежень на довжину. Якість голосу залежить від браузера/ОС;
 * якщо англійських голосів немає — `available()` = false, і кнопки озвучки ховаються.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly #synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  readonly #storage = inject(BrowserStorage);

  readonly #voices = signal<SpeechSynthesisVoice[]>([]);
  readonly englishVoices = computed(() =>
    this.#voices().filter((v) => normalizeLang(v.lang).startsWith('en')),
  );
  readonly available = computed(() => this.#synth !== null && this.englishVoices().length > 0);

  readonly accent = signal<SpeechAccent>(this.#storage.read(ACCENT_KEY) === 'en-GB' ? 'en-GB' : 'en-US');
  readonly rate = signal<SpeechRate>(this.#storage.read(RATE_KEY) === 0.75 ? 0.75 : 1);

  /** Ключ елемента, що зараз звучить (кнопка показує «стоп»), або null. */
  readonly speakingKey = signal<string | null>(null);
  readonly currentWord = signal<SpokenWord | null>(null);

  #session = 0;

  constructor() {
    const synth = this.#synth;
    if (!synth) return;
    const loadVoices = () => this.#voices.set(synth.getVoices());
    loadVoices();
    synth.addEventListener('voiceschanged', loadVoices);

    effect(() => this.#storage.write(ACCENT_KEY, this.accent()));
    effect(() => this.#storage.write(RATE_KEY, this.rate()));

    // Перехід на іншу сторінку зупиняє озвучку.
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationStart))
      .subscribe(() => this.stop());
  }

  toggle(text: string, key: string): void {
    if (this.speakingKey() === key) this.stop();
    else this.speak(text, key);
  }

  speak(text: string, key: string): void {
    const synth = this.#synth;
    const clean = text.trim();
    if (!synth || !clean) return;

    this.stop();
    const session = ++this.#session;
    const voice = this.#pickVoice();
    const chunks = splitIntoSpeechChunks(clean);
    this.speakingKey.set(key);

    const speakChunk = (index: number): void => {
      if (session !== this.#session) return;
      const chunk = chunks[index];
      if (!chunk) {
        this.#finish(session);
        return;
      }
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = voice?.lang ?? this.accent();
      if (voice) utterance.voice = voice;
      utterance.rate = this.rate();
      utterance.onboundary = (event) => {
        if (session !== this.#session || (event.name && event.name !== 'word')) return;
        const start = chunk.offset + event.charIndex;
        const length = event.charLength || wordLengthAt(chunk.text, event.charIndex);
        this.currentWord.set({ key, start, end: start + length });
      };
      utterance.onend = () => speakChunk(index + 1);
      // Власна зупинка вже змінила session (#finish нічого не зробить); переривання ззовні
      // (браузер, інша вкладка) чи помилка голосу — скидають стан кнопок.
      utterance.onerror = () => this.#finish(session);
      synth.speak(utterance);
    };
    speakChunk(0);
  }

  stop(): void {
    this.#session++;
    this.speakingKey.set(null);
    this.currentWord.set(null);
    this.#synth?.cancel();
  }

  toggleAccent(): void {
    this.accent.update((a) => (a === 'en-US' ? 'en-GB' : 'en-US'));
  }

  toggleRate(): void {
    this.rate.update((r) => (r === 1 ? 0.75 : 1));
  }

  #finish(session: number): void {
    if (session !== this.#session) return;
    this.speakingKey.set(null);
    this.currentWord.set(null);
  }

  /** Голос обраного акценту; серед них — «природні» (Natural/Neural/Online/Google), якщо є. */
  #pickVoice(): SpeechSynthesisVoice | null {
    const voices = this.englishVoices();
    const accent = this.accent().toLowerCase();
    const sameAccent = voices.filter((v) => normalizeLang(v.lang) === accent);
    const pool = sameAccent.length ? sameAccent : voices;
    const score = (v: SpeechSynthesisVoice) =>
      (/natural|neural|online|google|premium|enhanced/i.test(v.name) ? 2 : 0) + (v.default ? 1 : 0);
    return [...pool].sort((a, b) => score(b) - score(a))[0] ?? null;
  }
}

function normalizeLang(lang: string): string {
  return lang.toLowerCase().replace('_', '-');
}
