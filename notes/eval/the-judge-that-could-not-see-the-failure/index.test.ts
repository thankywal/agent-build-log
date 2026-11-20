import { describe, it, expect } from 'vitest';
import { judge, withoutVerbatim, type Expectation } from './index';

/**
 * The real case, retyped with the product and the price replaced.
 *
 * A customer wrote in English and gave a Chinese name. Before my change the
 * agent answered in English. After it, in Chinese. `firstJudge` is the judge I
 * had: product names out, then Latin letters present and none from the scripts
 * I had listed. It passed the Chinese reply five runs out of five, and the run
 * reported 76 right answers out of 80 when the truth was 71.
 */
const PRODUCT = 'Gold Hand Chain';
const NAME = '王伟';
const BEFORE = 'Hello 王伟, the Gold Hand Chain is 120 USD. It is 18K gold and is available. Would you like to see a picture?';
const AFTER = '您好王伟，Gold Hand Chain（18K金手链）的价格是 120 USD，目前有货。需要我为您展示图片或说明更多细节吗？';

const LISTED = ['Thai', 'Devanagari', 'Tamil', 'Myanmar', 'Hiragana', 'Katakana'];
const count = (text: string, script: string): number =>
  [...text].filter((ch) => new RegExp(`\\p{Script=${script}}`, 'u').test(ch)).length;

function firstJudge(reply: string): boolean {
  const own = withoutVerbatim(reply, [PRODUCT]);
  return count(own, 'Latin') > 0 && !LISTED.some((script) => count(own, script) > 0);
}

describe('a reply to an English message', () => {
  const english: Expectation = { scripts: ['Latin'], verbatim: [NAME, PRODUCT] };

  it('the judge I had passes a Chinese reply as English: four Latin letters were enough', () => {
    const own = withoutVerbatim(AFTER, [PRODUCT]);
    expect([...own].filter((ch) => /\p{Script=Latin}/u.test(ch)).join('')).toBe('KUSD');
    expect(count(own, 'Han')).toBe(32);
    expect(LISTED.some((script) => count(own, script) > 0)).toBe(false);
    expect(firstJudge(AFTER)).toBe(true);
  });

  it('the judge here refuses it and shows the letters', () => {
    const verdict = judge(AFTER, english);
    expect(verdict.ok).toBe(false);
    expect(verdict.wanted).toBe(4);
    expect(verdict.foreign).toBe(30);
    expect(verdict.sample.startsWith('您好')).toBe(true);
  });

  it('an English reply that greets the customer by a Chinese name is right', () => {
    expect(judge(BEFORE, english)).toMatchObject({ ok: true, foreign: 0 });
  });

  it('the same greeting is wrong until the judge is told whose name it is', () => {
    expect(judge(BEFORE, { scripts: ['Latin'], verbatim: [PRODUCT] })).toMatchObject({ ok: false, foreign: 2, sample: NAME });
  });

  it('a reply with no letters is not a pass', () => {
    expect(judge('120 !!', english).ok).toBe(false);
  });
});

describe('a reply to a Chinese message', () => {
  const chinese: Expectation = { scripts: ['Han'], verbatim: [PRODUCT], tolerated: ['Latin'] };

  it('may carry a currency code, because Latin is tolerated beside it', () => {
    expect(judge(AFTER, chinese)).toMatchObject({ ok: true, wanted: 32, tolerated: 4, foreign: 0 });
  });

  it('is wrong without that tolerance, so the tolerance is a decision and not an accident', () => {
    expect(judge(AFTER, { scripts: ['Han'], verbatim: [PRODUCT] })).toMatchObject({ ok: false, foreign: 4, sample: 'KUSD' });
  });

  it('is wrong in English', () => {
    expect(judge(BEFORE, { ...chinese, verbatim: [NAME, PRODUCT] }).ok).toBe(false);
  });

  it('is wrong in Japanese', () => {
    expect(judge('Gold Hand Chainは120 USDです。', chinese)).toMatchObject({ ok: false, foreign: 3 });
  });
});

describe('the pieces', () => {
  it('Japanese is three scripts, and the long vowel mark belongs to them', () => {
    const japanese: Expectation = { scripts: ['Hiragana', 'Katakana', 'Han'], verbatim: [PRODUCT], tolerated: ['Latin'] };
    expect(judge('Gold Hand Chain（ゴールドチェーン）は120 USDです。ご覧になりますか？', japanese)).toMatchObject({ ok: true, wanted: 19, tolerated: 3, foreign: 0 });
  });

  it('verbatim text goes longest first, so a full name is not left half behind', () => {
    expect(withoutVerbatim('Gold Hand Chain and Gold', ['Gold', 'Gold Hand Chain']).replace(/\s/g, '')).toBe('and');
  });
});
