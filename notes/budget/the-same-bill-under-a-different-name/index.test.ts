import { describe, it, expect } from 'vitest';
import { attributeRemainder, type MeasuredWindow } from './index';

/**
 * Two measured hours, the same clock hour three days apart, each side of the
 * ratio taken from an independent source: the numerator from the request log,
 * the denominator from the billing metric.
 *
 * Every number here was published.
 */
const BEFORE: MeasuredWindow = {
  billedSeconds: 3389.0,
  buckets: [
    { label: 'event stream', requests: 2, seconds: 3000.0 },
    { label: 'everything else', requests: 642, seconds: 8.4 },
    { label: 'scheduled jobs', requests: 54, seconds: 2.9 },
  ],
};

const AFTER: MeasuredWindow = {
  billedSeconds: 826.1,
  buckets: [
    { label: 'everything else', requests: 550, seconds: 807.5 },
    { label: 'scheduled jobs', requests: 54, seconds: 2.7 },
    { label: 'event stream poll', requests: 240, seconds: 1.5 },
  ],
};

/** The same after window, once I stopped accepting "everything else" as an answer. */
const AFTER_DRILLED: MeasuredWindow = {
  billedSeconds: 826.1,
  buckets: [
    { label: 'live socket', requests: 8, seconds: 787.2 },
    { label: 'everything else', requests: 542, seconds: 20.3 },
    { label: 'scheduled jobs', requests: 54, seconds: 2.7 },
    { label: 'event stream poll', requests: 240, seconds: 1.5 },
  ],
};

describe('what the bill is made of after a fix', () => {
  it('reports the headline drop that convinced me I was done', () => {
    const r = attributeRemainder(BEFORE, AFTER, { target: 'event stream' });

    expect(r.reduction).toBeCloseTo(0.756, 3); // 75.6%
    expect(r.target?.beforeSeconds).toBe(3000.0);
    expect(r.target?.afterSeconds).toBe(0); // the endpoint went unused
    expect(r.target?.reduction).toBe(1);
  });

  it('names the bucket that is now the entire bill', () => {
    const r = attributeRemainder(BEFORE, AFTER, { target: 'event stream' });

    // The fix worked and this is still what I was paying for. At the headline
    // the two outcomes are indistinguishable.
    expect(r.dominant?.label).toBe('everything else');
    expect(r.dominant?.shareOfRemainder).toBeGreaterThan(0.99);
    expect(r.residual[0].label).toBe('everything else');
  });

  it('finds the second connection once the vague bucket is split', () => {
    const r = attributeRemainder(BEFORE, AFTER_DRILLED, { target: 'event stream' });

    expect(r.dominant?.label).toBe('live socket');
    expect(r.dominant?.shareOfRemainder).toBeCloseTo(0.97, 2); // 787.2 of 811.7
    expect(r.dominant?.requests).toBe(8);
  });

  it('refuses to say a bucket grew when it was never measured before', () => {
    // 🔴 RED CHECK. Make the missing lookup default to 0 instead of null in
    // index.ts and this fails. The socket would then be reported as having
    // grown from nothing, which is the one claim the measurement does not
    // support and the exact claim I wanted to make.
    const r = attributeRemainder(BEFORE, AFTER_DRILLED, { target: 'event stream' });
    const socket = r.residual.find((b) => b.label === 'live socket');

    expect(socket?.beforeSeconds).toBeNull();
    expect(socket?.grew).toBe(false);

    const poll = r.residual.find((b) => b.label === 'event stream poll');
    expect(poll?.beforeSeconds).toBeNull();
    expect(poll?.grew).toBe(false);
  });

  it('does report growth where both windows measured the same bucket', () => {
    const r = attributeRemainder(BEFORE, AFTER, { target: 'event stream' });
    const other = r.residual.find((b) => b.label === 'everything else');

    // 8.4 seconds to 807.5, and I had never once looked inside it.
    expect(other?.beforeSeconds).toBe(8.4);
    expect(other?.grew).toBe(true);

    const jobs = r.residual.find((b) => b.label === 'scheduled jobs');
    expect(jobs?.grew).toBe(false); // 2.9 to 2.7
  });

  it('does not flag a remainder that is genuinely spread out', () => {
    const spread: MeasuredWindow = {
      billedSeconds: 100,
      buckets: [
        { label: 'a', requests: 10, seconds: 30 },
        { label: 'b', requests: 10, seconds: 30 },
        { label: 'c', requests: 10, seconds: 30 },
      ],
    };
    const r = attributeRemainder(BEFORE, spread);
    expect(r.dominant).toBeNull();
  });

  it('survives an empty after window without dividing by zero', () => {
    const r = attributeRemainder(BEFORE, { billedSeconds: 0, buckets: [] });
    expect(r.reduction).toBe(1);
    expect(r.residual).toEqual([]);
    expect(r.dominant).toBeNull();
  });
});
