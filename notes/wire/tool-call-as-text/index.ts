/**
 * Recover tool calls a model wrote as TEXT instead of emitting through the
 * structured `tool_calls` field.
 *
 * The markers use FULLWIDTH VERTICAL LINE (U+FF5C), not ASCII '|'.
 *
 * Tolerant on purpose: the block is usually truncated, because the model spends
 * its whole output budget writing the markup. A half written call is still the
 * call it meant to make, so the last parameter runs to the end of the buffer.
 */
export interface RecoveredCall {
  name: string;
  args: Record<string, string>;
}

const INVOKE_RE = /<｜DSML｜invoke\s+name="([^"]+)"\s*>/g;
const PARAM_RE = /<｜DSML｜parameter\s+name="([^"]+)"(?:\s+string="(?:true|false)")?\s*>/g;

export function recoverInlineCalls(raw: string): RecoveredCall[] {
  const out: RecoveredCall[] = [];
  if (!raw) return out;

  const invokes: Array<{ name: string; from: number }> = [];
  INVOKE_RE.lastIndex = 0;
  for (let m = INVOKE_RE.exec(raw); m; m = INVOKE_RE.exec(raw)) {
    invokes.push({ name: m[1]!, from: m.index + m[0].length });
  }

  for (let i = 0; i < invokes.length; i++) {
    const { name, from } = invokes[i]!;
    // Up to the NEXT invoke, or the end of what we were given. The end is what
    // makes truncation survivable.
    const to = i + 1 < invokes.length ? invokes[i + 1]!.from : raw.length;
    const body = raw.slice(from, to);

    const params: Array<{ key: string; from: number }> = [];
    PARAM_RE.lastIndex = 0;
    for (let p = PARAM_RE.exec(body); p; p = PARAM_RE.exec(body)) {
      params.push({ key: p[1]!, from: p.index + p[0].length });
    }

    const args: Record<string, string> = {};
    for (let k = 0; k < params.length; k++) {
      const { key, from: pf } = params[k]!;
      const pt = k + 1 < params.length ? params[k + 1]!.from : body.length;
      args[key] = body
        .slice(pf, pt)
        .replace(/<｜DSML｜[^>]*>\s*$/, '')   // drop a trailing close marker
        .trim();
    }
    out.push({ name, args });
  }
  return out;
}

/** True when a response body looks like it carries an inline call at all.
 *  Cheap enough to run on every response before paying for the parse. */
export function looksLikeInlineCall(raw: string): boolean {
  return typeof raw === 'string' && raw.includes('<｜DSML｜invoke');
}
