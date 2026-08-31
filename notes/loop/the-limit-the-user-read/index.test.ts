import { describe, it, expect } from 'vitest';
import { TurnLedger } from './index.js';

const KEY = 'send_file_to_chat|{"path":"/tmp/poster.png"}';

describe('one record, every count a view over it', () => {
  it('two views of the same two failures cannot disagree', () => {
    // The failure this file exists for: two counters, two files, same instant,
    // opposite verdicts. Here both answers come off the same rows.
    const ledger = new TurnLedger();
    ledger.record(KEY, false, 'file not found');
    ledger.record(KEY, false, 'file not found');

    expect(ledger.size).toBe(2);
    expect(ledger.repeats(KEY)).toBe(2);
    expect(ledger.failures(KEY)).toBe(2);
    expect(ledger.failures(KEY, 'file not found')).toBe(2);
    expect(ledger.failures(KEY, 'permission denied')).toBe(0);
  });

  it('a turn that only repeats itself has one novel call', () => {
    const ledger = new TurnLedger();
    for (let i = 0; i < 5; i += 1) ledger.record(KEY, false, 'file not found');
    ledger.record('web_search|{"q":"poster"}', true);
    expect(ledger.novel()).toBe(2);
    expect(ledger.repeats(KEY)).toBe(5);
  });
});

describe('advice, never a refusal', () => {
  it('says nothing early, then names the run, and never blocks', () => {
    const ledger = new TurnLedger();
    const spoken: Array<number | null> = [];
    for (let i = 1; i <= 9; i += 1) {
      ledger.record(KEY, false, 'file not found');
      spoken.push(ledger.advice(KEY) === null ? null : i);
    }
    // Quiet at 1 and 2, speaks at 3, 5 and 8, and keeps speaking past the last mark.
    expect(spoken).toEqual([null, null, 3, null, 5, null, null, 8, 9]);
    // Nothing in this file can stop a call: the ledger has no veto to offer.
    expect(Object.keys(new TurnLedger())).not.toContain('blocked');
  });

  it('the words name the count, so the model can act on them', () => {
    const ledger = new TurnLedger();
    for (let i = 0; i < 3; i += 1) ledger.record(KEY, false);
    expect(ledger.advice(KEY)).toContain('3 times');
    expect(ledger.advice(KEY)).not.toContain('will not be run');
  });
});
