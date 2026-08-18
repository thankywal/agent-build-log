/**
 * Payload per billed second.
 *
 * This exists because I could not tell an expensive connection from a cheap one
 * by counting requests. Under request based billing an open connection holds the
 * instance busy and the meter charges elapsed time, so a connection carrying
 * nothing costs exactly what one doing real work costs. Request volume hides
 * that completely: in the hour that started this, the entire bill was two rows
 * out of six hundred and ninety eight.
 *
 * Feed it one row per connection. It gives back bytes delivered per billed
 * second, and marks the connections sitting at the floor, meaning they carried
 * only the keepalives and headers an empty connection sends anyway.
 *
 * No imports beyond the standard library. Lift the file.
 */

export interface ConnectionRow {
  /** Whatever identifies the connection in your own logs. */
  id: string;
  /** Seconds the connection stayed open, which is what an elapsed time meter bills. */
  billedSeconds: number;
  /** Bytes that reached the client, headers and keepalives included. */
  bytesDelivered: number;
}

export interface ConnectionVerdict extends ConnectionRow {
  bytesPerBilledSecond: number;
  /** True when the connection carried nothing above what an empty one costs. */
  atFloor: boolean;
}

export interface PayloadOptions {
  /**
   * Bytes an empty connection delivers anyway. Leave it out and the smallest row
   * in the set is used, which is the honest empirical floor: nothing you measured
   * did less than that.
   */
  floorBytes?: number;
  /** Your provider's rate per billed second, if you want the cost line. */
  costPerBilledSecond?: number;
}

export interface PayloadReport {
  connections: ConnectionVerdict[];
  billedSeconds: number;
  bytesDelivered: number;
  /** The headline. Payload bought per second of billing. */
  bytesPerBilledSecond: number;
  /** The floor actually used, whether supplied or derived. */
  floorBytes: number;
  /** How many connections carried nothing above that floor. */
  atFloor: number;
  /** Only present when a rate was supplied. */
  costUsd?: number;
}

export function payloadPerBilledSecond(
  rows: readonly ConnectionRow[],
  options: PayloadOptions = {},
): PayloadReport {
  const floorBytes =
    options.floorBytes ??
    (rows.length ? Math.min(...rows.map((r) => r.bytesDelivered)) : 0);

  const connections: ConnectionVerdict[] = rows.map((r) => ({
    ...r,
    // A connection that cost nothing cannot be wasteful, so it scores zero
    // rather than dividing by zero and reporting Infinity.
    bytesPerBilledSecond:
      r.billedSeconds > 0 ? r.bytesDelivered / r.billedSeconds : 0,
    // Inclusive on purpose. A connection sitting exactly on the floor is the
    // case this whole file exists to find, and `<` would step straight past it.
    atFloor: r.bytesDelivered <= floorBytes,
  }));

  const billedSeconds = rows.reduce((n, r) => n + r.billedSeconds, 0);
  const bytesDelivered = rows.reduce((n, r) => n + r.bytesDelivered, 0);

  const report: PayloadReport = {
    connections,
    billedSeconds,
    bytesDelivered,
    bytesPerBilledSecond: billedSeconds > 0 ? bytesDelivered / billedSeconds : 0,
    floorBytes,
    atFloor: connections.filter((c) => c.atFloor).length,
  };

  if (options.costPerBilledSecond !== undefined) {
    report.costUsd = billedSeconds * options.costPerBilledSecond;
  }

  return report;
}
