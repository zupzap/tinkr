const ENDS_SENTENCE = /[.!?…]["')\]]*$/;

const AFTER_NEW_LINE_MS = 800;
const AFTER_SENTENCE_MS = 1500;
/** Plenty of people never punctuate, so a long enough silence also counts as finished. */
const AFTER_SILENCE_MS = 8000;

export type Moment = {
  /** How long the writer must stop before the partner reads. */
  delay: number;
  /** A natural place to respond, so it can skip the usual gap between comments. */
  urgent: boolean;
};

/** Judges from the line being written whether the thought looks finished. */
export function readMoment(line: string): Moment {
  const text = line.trim();
  if (!text) return { delay: AFTER_NEW_LINE_MS, urgent: true };
  if (ENDS_SENTENCE.test(text)) return { delay: AFTER_SENTENCE_MS, urgent: text.endsWith("?") };
  return { delay: AFTER_SILENCE_MS, urgent: false };
}

/** True when they kept writing the same passage a comment was being written about. */
export function kept(writing: string, sent: string) {
  return writing !== sent && writing.startsWith(sent);
}
