/**
 * Input / output guards for AI features (pure functions, unit tested).
 * User text is untrusted: it is cleaned, length-limited and always sent inside delimiters,
 * and the instructions tell the model to treat it as data. Outputs are checked again after
 * schema validation.
 */

// Written with escapes on purpose: some of these characters are invisible line separators.
const CONTROL = new RegExp(
  `[${String.raw`\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028\u2029\uFEFF`}]`,
  'g',
);
const DELIMITER = /<<<|>>>/g;

/** Normalises user-written text before it reaches a prompt or the database. */
export function cleanUserText(text: string, maxLength: number): string {
  return text
    .normalize('NFC')
    .replace(CONTROL, '')
    .replace(DELIMITER, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

/** Wraps untrusted text so instructions can refer to it as data. */
export function untrusted(label: string, text: string): string {
  return `<<<${label}>>>\n${text.replace(DELIMITER, '')}\n<<<END_${label}>>>`;
}

const INJECTION_PATTERNS = [
  /ignore (all |any )?(the )?(previous|above|prior) (instructions|rules)/i,
  /disregard (the )?(previous|above|system)/i,
  /(reveal|show|print) (the |your )?(system )?prompt/i,
  /you are now\b/i,
  /act as (a|an) /i,
  /developer mode/i,
  /өмнөх\s+(заав(а)?р|дүрэм)/iu,
  /system prompt/i,
];

/** Heuristic flag (logged; the request is still answered safely). */
export function looksLikeInjection(text: string): boolean {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

const URL = /\b(?:https?:\/\/|www\.)\S+/i;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE = /(?:\+?\d[\s-]?){8,}/;

export type OutputViolation = 'URL' | 'EMAIL' | 'PHONE';

/** Model output must not send children (or anyone) to links or contacts. */
export function outputViolations(text: string): OutputViolation[] {
  const found: OutputViolation[] = [];
  if (URL.test(text)) found.push('URL');
  if (EMAIL.test(text)) found.push('EMAIL');
  if (PHONE.test(text)) found.push('PHONE');
  return found;
}

/** Rough token estimate (Cyrillic averages ~3 chars/token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3);
}
