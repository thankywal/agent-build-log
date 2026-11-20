/**
 * Is this reply written in the script it should be in?
 *
 * This exists because my eval judge decided "this reply is English" by asking
 * two things: are there Latin letters, and are there no letters from the five
 * scripts I had listed. A reply written in Chinese was not on that list. It
 * carried a price in USD and the K of 18K, so the judge counted four Latin
 * letters, found none of the listed scripts, and passed it. The run reported 76
 * right answers out of 80. The truth was 71, and the five it hid were a
 * regression that my own change had caused.
 *
 * `judge` turns the rule around. You say what a right answer is made of: the
 * scripts it is written in, the text that is right in any language (a person's
 * name, a product, an address), and what may sit beside them, like a currency
 * code inside a Chinese sentence. Every other letter makes the answer wrong,
 * and the verdict shows you those letters.
 *
 * No imports beyond the standard library. Lift the file.
 */

export interface Expectation {
  /** Unicode script names a right answer is written in: ['Latin'], ['Han'], or ['Hiragana', 'Katakana', 'Han'] for Japanese. */
  scripts: readonly string[];
  /** Text that is right in any language, taken out before counting: the customer's own name, a product, an address. */
  verbatim?: readonly string[];
  /** Scripts that may sit beside the wanted ones without making the answer wrong: Latin in a Chinese reply, for a currency code. */
  tolerated?: readonly string[];
}

export interface Verdict {
  ok: boolean;
  /** Letters in the scripts a right answer is written in. */
  wanted: number;
  /** Letters in a tolerated script. */
  tolerated: number;
  /** Letters that should not be there. A right answer has none. */
  foreign: number;
  /** The first of those letters, so a person can see what the judge saw. */
  sample: string;
}

const LETTER = /\p{L}/u;
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Script_Extensions and not Script: the long vowel mark in a Japanese word is shared between scripts.
const inScript = (name: string): RegExp => new RegExp(`\\p{Script_Extensions=${name}}`, 'u');

/** The reply with the verbatim text taken out, longest first, so a full name goes before a part of it. */
export function withoutVerbatim(reply: string, verbatim: readonly string[] = []): string {
  return [...verbatim]
    .filter((v) => v.length > 0)
    .sort((a, b) => b.length - a.length)
    .reduce((text, v) => text.replace(new RegExp(escaped(v), 'giu'), ' '), reply);
}

/**
 * Right only when the reply has letters in the wanted scripts and no letter outside the wanted and the
 * tolerated ones. A script nobody thought of fails here. That is the whole point.
 */
export function judge(reply: string, expectation: Expectation): Verdict {
  const wantedScripts = expectation.scripts.map(inScript);
  const toleratedScripts = (expectation.tolerated ?? []).map(inScript);
  let wanted = 0;
  let tolerated = 0;
  let foreign = 0;
  let sample = '';
  for (const ch of withoutVerbatim(reply, expectation.verbatim)) {
    if (!LETTER.test(ch)) continue;
    if (wantedScripts.some((re) => re.test(ch))) wanted += 1;
    else if (toleratedScripts.some((re) => re.test(ch))) tolerated += 1;
    else {
      foreign += 1;
      if (foreign <= 12) sample += ch;
    }
  }
  return { ok: wanted > 0 && foreign === 0, wanted, tolerated, foreign, sample };
}
