import { describe, it, expect } from 'vitest';
import { recoverInlineCalls, looksLikeInlineCall } from './index.js';

describe('recoverInlineCalls', () => {
  it('recovers a complete call', () => {
    const raw = '<｜DSML｜invoke name="exec_bash">'
      + '<｜DSML｜parameter name="command">ls -la<｜DSML｜/parameter>';
    expect(recoverInlineCalls(raw)).toEqual([
      { name: 'exec_bash', args: { command: 'ls -la' } },
    ]);
  });

  it('recovers a TRUNCATED call, which is the common case', () => {
    // The model ran out of budget mid argument. This is what actually arrives.
    const raw = '<｜DSML｜invoke name="exec_bash">'
      + '<｜DSML｜parameter name="command">psql -c "select id, name from produ';
    const [call] = recoverInlineCalls(raw);
    expect(call!.name).toBe('exec_bash');
    expect(call!.args.command).toBe('psql -c "select id, name from produ');
  });

  it('recovers several calls in one block', () => {
    const raw = '<｜DSML｜invoke name="a"><｜DSML｜parameter name="x">1'
      + '<｜DSML｜invoke name="b"><｜DSML｜parameter name="y">2';
    expect(recoverInlineCalls(raw).map((c) => c.name)).toEqual(['a', 'b']);
  });

  it('keeps quotes and newlines inside an argument intact', () => {
    // Escaping is exactly what the model gets wrong, so the parser must not
    // depend on it being right.
    const raw = '<｜DSML｜invoke name="run"><｜DSML｜parameter name="code">'
      + 'print("hi")\nprint(\'bye\')';
    expect(recoverInlineCalls(raw)[0]!.args.code)
      .toBe('print("hi")\nprint(\'bye\')');
  });

  it('returns nothing for ordinary prose', () => {
    expect(recoverInlineCalls('Sure, let me check that for you.')).toEqual([]);
    expect(recoverInlineCalls('')).toEqual([]);
  });

  it('🔴 the delimiter is U+FF5C, not the pipe on your keyboard', () => {
    // The hour I lost. A pattern written against ASCII '|' matches nothing,
    // and nothing about the source code tells you why.
    const ascii = '<|DSML|invoke name="exec_bash">'
      + '<|DSML|parameter name="command">ls';
    expect(recoverInlineCalls(ascii)).toEqual([]);
    expect('｜'.charCodeAt(0)).toBe(65372);
    expect('|'.charCodeAt(0)).toBe(124);
  });
});

describe('looksLikeInlineCall', () => {
  it('is cheap to ask before paying for the parse', () => {
    expect(looksLikeInlineCall('<｜DSML｜invoke name="x">')).toBe(true);
    expect(looksLikeInlineCall('a normal answer')).toBe(false);
  });
});
