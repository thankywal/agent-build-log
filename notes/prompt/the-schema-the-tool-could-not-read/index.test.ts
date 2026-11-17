import { describe, it, expect } from 'vitest';
import { cardFrom, parseCard, unreadable, type Surface } from './index';

/**
 * The shape of the real turn, with my table and column names replaced.
 *
 * OWNER_CARD is what the prompt carried: the database as the application sees
 * it. TOOL is what the model's SQL tool could select with its own role: every
 * table carries the shop's name, the owning id is hidden, and the rules table
 * is not there at all. The model was asked for rules per shop. The card showed
 * an id on `shops` and a `rules` table keyed by it, so that is what it asked
 * for, four times, and each attempt was refused.
 */
const OWNER_CARD = [
  'shops(id int, name text, created_at ts)',
  'rules(id int, shop_id int, kind text, is_active bool)',
  'orders(id int, shop_id int, status text, total num)',
].join('\n');

const TOOL: Surface = {
  shops: ['name', 'created_at'],
  orders: ['id', 'shop_name', 'status', 'total'],
};

describe('the card against what the tool can read', () => {
  it('names what the prompt showed and the tool could not read', () => {
    expect(unreadable(OWNER_CARD, TOOL)).toEqual([
      { table: 'shops', column: 'id' }, // the join the card taught
      { table: 'rules' }, // the table the question was about
      { table: 'orders', column: 'shop_id' },
    ]);
  });

  it('reports a table the tool cannot reach at all', () => {
    // 🔴 RED CHECK. Rewrite `unreadable` to loop over the surface instead of
    // the card and this is the assertion that fails. A table missing from the
    // tool's view is then never visited, the answer is empty, and the card
    // that caused the turn passes its own check.
    expect(unreadable('rules(id int, shop_id int)', { shops: ['name'] })).toEqual([
      { table: 'rules' },
    ]);
  });

  it('finds nothing wrong with a card built from the tool view', () => {
    // The fix, as a property: a card made by asking the tool cannot show the
    // model anything the tool will refuse.
    expect(unreadable(cardFrom(TOOL), TOOL)).toEqual([]);
  });

  it('reads the card the way it is written', () => {
    const card = [
      'orders(id int, total num, …)',
      '-- join key: shop_name on every table',
      '',
      'shops(name text)',
    ].join('\n');
    expect(parseCard(card)).toEqual([
      { table: 'orders', columns: ['id', 'total'] },
      { table: 'shops', columns: ['name'] },
    ]);
  });

  it('compares names the way the database folds them', () => {
    expect(unreadable('Shops(Name text, ID int)', { shops: ['name'] })).toEqual([
      { table: 'Shops', column: 'ID' },
    ]);
  });

  it('writes the types next to the columns when asked', () => {
    const card = cardFrom({ shops: ['name', 'created_at'] }, (_t, c) =>
      c === 'name' ? 'text' : 'ts',
    );
    expect(card).toBe('shops(name text, created_at ts)');
    expect(unreadable(card, { shops: ['name', 'created_at'] })).toEqual([]);
  });

  it('has nothing to say about an empty card', () => {
    expect(unreadable('', TOOL)).toEqual([]);
  });
});
