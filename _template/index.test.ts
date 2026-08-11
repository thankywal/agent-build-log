import { describe, it, expect } from 'vitest';
import { replaceMe } from './index.js';

describe('replaceMe', () => {
  it('does the thing the entry claims it does', () => {
    expect(replaceMe('x')).toBe('x');
  });

  // The test that matters is the one that FAILS against the old behaviour.
  // Write it, revert the fix, watch it go red, put the fix back. An entry
  // whose test passes either way is an entry that proves nothing.
});
