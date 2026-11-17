/**
 * Does the schema in the prompt match what the tool can read?
 *
 * This exists because my prompt carried a compact card of the database, table by
 * table and column by column, with an instruction to write SQL straight against
 * it. The card was built by the application, with the application's rights. The
 * model's SQL tool connected with a narrower role that saw a different set of
 * columns. So the model wrote the join the card taught, the role refused it, and
 * a turn that cost 713,638 input tokens ended with no file and a sentence saying
 * it could not complete the task.
 *
 * Give `unreadable` the card and the columns the tool's own connection can
 * select. It names everything the card shows that the tool cannot read. An empty
 * answer is the only acceptable one, and `cardFrom` is the way to get it: build
 * the card from the tool's view in the first place, so the two cannot drift.
 *
 * No imports beyond the standard library. Lift the file.
 */

/** Table name to the columns the TOOL can select, asked with the tool's own rights. */
export type Surface = Readonly<Record<string, readonly string[]>>;

export interface CardTable {
  table: string;
  columns: string[];
}

export interface Unreadable {
  table: string;
  /** Absent when the whole table is out of the tool's reach. */
  column?: string;
}

/**
 * Read a compact card: one `table(column type, column type)` per line. Lines
 * that start with `--` are notes for the model, not tables, and a trailing `…`
 * marks a column list that was cut for length.
 */
export function parseCard(card: string): CardTable[] {
  const tables: CardTable[] = [];
  for (const raw of card.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('--')) continue;
    const m = /^([A-Za-z_][\w.]*)\s*\((.*)\)\s*$/.exec(line);
    if (!m) continue;
    const columns = m[2]
      .split(',')
      .map((c) => c.trim().split(/\s+/)[0] ?? '')
      .filter((c) => c !== '' && c !== '…' && c !== '...');
    tables.push({ table: m[1], columns });
  }
  return tables;
}

/**
 * Everything the card shows that the tool cannot read.
 *
 * It walks the CARD, not the surface. Walk the surface and a table the tool
 * cannot reach at all is never visited, which reports a clean card on the exact
 * case that sends the model to a table it will be refused.
 */
export function unreadable(card: string, surface: Surface): Unreadable[] {
  // Unquoted identifiers fold to lower case in the databases I use, so compare
  // them folded: `Orders(ID)` and `orders(id)` are the same thing to the tool.
  const readable = new Map<string, Set<string>>();
  for (const [table, columns] of Object.entries(surface)) {
    readable.set(table.toLowerCase(), new Set(columns.map((c) => c.toLowerCase())));
  }

  const out: Unreadable[] = [];
  for (const { table, columns } of parseCard(card)) {
    const visible = readable.get(table.toLowerCase());
    if (!visible) {
      out.push({ table });
      continue;
    }
    for (const column of columns) {
      if (!visible.has(column.toLowerCase())) out.push({ table, column });
    }
  }
  return out;
}

/**
 * Build the card from the tool's view, so there is nothing to compare. Pass a
 * `typeOf` if you want the short type next to each column.
 */
export function cardFrom(
  surface: Surface,
  typeOf?: (table: string, column: string) => string | undefined,
): string {
  return Object.keys(surface)
    .sort()
    .map((table) => {
      const columns = surface[table].map((column) => {
        const type = typeOf?.(table, column);
        return type ? `${column} ${type}` : column;
      });
      return `${table}(${columns.join(', ')})`;
    })
    .join('\n');
}
