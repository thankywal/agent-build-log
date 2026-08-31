/**
 * One append only record of a turn, and every count as a view over it.
 *
 * Written after a turn in which two counters, in two files, watched the same two
 * failures and reached opposite verdicts in the same instant: one had decided the
 * call was a repeat worth refusing, the other had never seen a repeat, because it
 * keyed the call differently. There was no single place to ask what had happened.
 * The refusal that won reached the user as prose, in a reply that was supposed to
 * carry an image.
 *
 * So: calls are appended, never counted. `repeats`, `failures` and `novel` are
 * questions asked of the rows, which is why they cannot drift apart. And nothing
 * here blocks: `advice` returns words at the thresholds and the caller still runs
 * the call. Three agent harnesses I compared answer a repeating model with
 * information and none of them forces a tool; a limit the model must fight is a
 * limit your user ends up reading.
 *
 * No dependencies. Drop the file in and keep one of these per turn.
 */

export interface CallRow {
  /** Whatever identifies "the same call again": usually tool name plus arguments. */
  readonly key: string;
  readonly ok: boolean;
  /** A short signature of the failure, so "failed the same way" is answerable. */
  readonly errorSignature?: string;
  readonly at: number;
}

/** Where the reminders land. The first is a nudge; the later ones name the run. */
export const ADVICE_AT: readonly number[] = [3, 5, 8];

export class TurnLedger {
  private readonly rows: CallRow[] = [];

  /** The only writer. Every dispatched call, success or failure, lands here once. */
  record(key: string, ok: boolean, errorSignature?: string, at: number = Date.now()): void {
    this.rows.push(errorSignature === undefined
      ? { key, ok, at }
      : { key, ok, errorSignature, at });
  }

  get size(): number {
    return this.rows.length;
  }

  /** How many times this exact call has been dispatched this turn. */
  repeats(key: string): number {
    return this.rows.filter((r) => r.key === key).length;
  }

  /** How many times it failed, and optionally how many times it failed the SAME way. */
  failures(key: string, errorSignature?: string): number {
    return this.rows.filter((r) => r.key === key && !r.ok
      && (errorSignature === undefined || r.errorSignature === errorSignature)).length;
  }

  /** Calls this turn that had never been made before. A turn with none is spinning. */
  novel(): number {
    const seen = new Set<string>();
    let n = 0;
    for (const r of this.rows) {
      if (!seen.has(r.key)) { seen.add(r.key); n += 1; }
    }
    return n;
  }

  /**
   * What to tell the model, if anything. It is never a refusal: the caller runs the
   * call regardless, and the words ride alongside the result.
   */
  advice(key: string): string | null {
    const n = this.repeats(key);
    const last = ADVICE_AT[ADVICE_AT.length - 1] ?? 0;
    if (!ADVICE_AT.includes(n) && n <= last) return null;
    return `This call has now run ${n} times this turn with the same arguments. `
      + 'If something changed in between, the result will show it. If nothing changed, '
      + 'the result will be the same as last time, and the way forward is a different '
      + 'approach, different arguments, or telling the user plainly where things stand.';
  }
}
