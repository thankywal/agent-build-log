/**
 * What is the bill made of now.
 *
 * This exists because I shipped a fix, measured a 75.6% drop, and called it
 * done. The number was real. The conclusion was not. The pattern I thought I
 * had removed was still running, on a different connection, and it was 97% of
 * everything left. I had measured the delta and never looked at the remainder.
 *
 * So this does not report an improvement. It reports the composition of what
 * survived: every bucket's share of the remaining seconds, sorted, with the
 * dominant one named. A fix that removes one instance of a pattern looks
 * identical, at the headline, to a fix that removes the pattern.
 *
 * One rule it enforces on purpose: a bucket that was not measured in the before
 * window gets `beforeSeconds: null` and `grew: false`. It never claims growth it
 * cannot prove. That claim is exactly the one I wanted to make and could not.
 *
 * No imports beyond the standard library. Lift the file.
 */

export interface Bucket {
  /** How you group requests. Endpoint, family, job name, whatever you measure by. */
  label: string;
  requests: number;
  /** Summed request seconds for the bucket. */
  seconds: number;
}

export interface MeasuredWindow {
  /** What the provider actually charged for the window. */
  billedSeconds: number;
  buckets: readonly Bucket[];
}

export interface ResidualBucket extends Bucket {
  /** This bucket's share of everything still on the bill. */
  shareOfRemainder: number;
  /** Null when the bucket was not present in the before window. */
  beforeSeconds: number | null;
  /** Only ever true when there is a before value to compare against. */
  grew: boolean;
}

export interface FixOptions {
  /** Label of the bucket you set out to fix, so its own result is reported separately. */
  target?: string;
  /** Share of the remainder that counts as dominant. Default 0.5. */
  dominantShare?: number;
}

export interface FixReport {
  billedBefore: number;
  billedAfter: number;
  /** The headline, and the number that fooled me. */
  reduction: number;
  target: {
    label: string;
    beforeSeconds: number;
    afterSeconds: number;
    reduction: number;
  } | null;
  /** Every after bucket, largest first. */
  residual: ResidualBucket[];
  /** The largest bucket that is not the thing you fixed, when it dominates. */
  dominant: ResidualBucket | null;
}

export function attributeRemainder(
  before: MeasuredWindow,
  after: MeasuredWindow,
  options: FixOptions = {},
): FixReport {
  const dominantShare = options.dominantShare ?? 0.5;
  const remainder = after.buckets.reduce((n, b) => n + b.seconds, 0);

  const residual: ResidualBucket[] = after.buckets
    .map((b) => {
      const prior = before.buckets.find((p) => p.label === b.label);
      // Absent is not zero. A bucket nobody measured before cannot be shown to
      // have grown, and defaulting it to 0 would report growth for every bucket
      // that is simply new. That is the false claim this file refuses to make.
      const beforeSeconds = prior ? prior.seconds : null;
      return {
        ...b,
        shareOfRemainder: remainder > 0 ? b.seconds / remainder : 0,
        beforeSeconds,
        grew: beforeSeconds !== null && b.seconds > beforeSeconds,
      };
    })
    .sort((a, b) => b.seconds - a.seconds);

  const targetBefore = options.target
    ? before.buckets.find((b) => b.label === options.target)
    : undefined;
  const targetAfter = options.target
    ? after.buckets.find((b) => b.label === options.target)
    : undefined;

  const target =
    options.target && targetBefore
      ? {
          label: options.target,
          beforeSeconds: targetBefore.seconds,
          afterSeconds: targetAfter ? targetAfter.seconds : 0,
          reduction:
            targetBefore.seconds > 0
              ? (targetBefore.seconds - (targetAfter ? targetAfter.seconds : 0)) /
                targetBefore.seconds
              : 0,
        }
      : null;

  const top = residual.find((b) => b.label !== options.target) ?? null;

  return {
    billedBefore: before.billedSeconds,
    billedAfter: after.billedSeconds,
    reduction:
      before.billedSeconds > 0
        ? (before.billedSeconds - after.billedSeconds) / before.billedSeconds
        : 0,
    target,
    residual,
    dominant: top && top.shareOfRemainder >= dominantShare ? top : null,
  };
}
