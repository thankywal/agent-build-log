import { describe, it, expect } from 'vitest';
import { payloadPerBilledSecond, type ConnectionRow } from './index';

/**
 * The real measurement: eight connections, back to back, over about three and a
 * third hours.
 *
 * Recorded and published: 8 connections, 12,000 billed seconds, 22.6 KiB
 * delivered, a keepalive and header floor near 1,364 bytes, four of the eight
 * sitting on that floor, 1.93 bytes per billed second, $0.64.
 *
 * Each connection ran to the same 25 minute lifecap, so every row bills 1,500
 * seconds and eight of them make the 12,000 exactly.
 *
 * ONE NUMBER HERE IS RECONSTRUCTED and it is worth naming. The four rows on the
 * floor are the measured 1,364. For the four that carried real traffic only
 * their TOTAL survives in my notes, 17,686 bytes, so the split below is one
 * plausible division of a measured sum. Every assertion in this file is on an
 * aggregate or on the floor count, never on those four individual values.
 */
const MEASURED: ConnectionRow[] = [
  { id: 'c1', billedSeconds: 1500, bytesDelivered: 1364 },
  { id: 'c2', billedSeconds: 1500, bytesDelivered: 1842 },
  { id: 'c3', billedSeconds: 1500, bytesDelivered: 1364 },
  { id: 'c4', billedSeconds: 1500, bytesDelivered: 3270 },
  { id: 'c5', billedSeconds: 1500, bytesDelivered: 1364 },
  { id: 'c6', billedSeconds: 1500, bytesDelivered: 5108 },
  { id: 'c7', billedSeconds: 1500, bytesDelivered: 1364 },
  { id: 'c8', billedSeconds: 1500, bytesDelivered: 7466 },
];

/** Cloud Run, 2 vCPU and 2 GiB, request based billing. */
const RATE = 0.000053;

describe('payload per billed second', () => {
  it('reproduces the measurement that was published', () => {
    const r = payloadPerBilledSecond(MEASURED, {
      floorBytes: 1364,
      costPerBilledSecond: RATE,
    });

    expect(r.billedSeconds).toBe(12_000);
    expect(r.bytesDelivered).toBe(23_142); // 22.6 KiB
    expect(r.bytesPerBilledSecond).toBeCloseTo(1.93, 2);
    expect(r.costUsd).toBeCloseTo(0.64, 2);
  });

  it('finds the connections that carried nothing', () => {
    const r = payloadPerBilledSecond(MEASURED, { floorBytes: 1364 });

    // This is the whole point. Four of eight billed 25 minutes each for a
    // keepalive and a header, and by request count they look identical to the
    // four that did real work.
    expect(r.atFloor).toBe(4);
    expect(r.connections.filter((c) => c.atFloor).map((c) => c.id)).toEqual([
      'c1',
      'c3',
      'c5',
      'c7',
    ]);
  });

  it('derives the floor from the rows when it is not supplied', () => {
    // You will not always know your floor. The smallest row is the honest
    // stand in: nothing you measured did less than that.
    const r = payloadPerBilledSecond(MEASURED);
    expect(r.floorBytes).toBe(1364);
    expect(r.atFloor).toBe(4);
  });

  it('counts a connection sitting exactly on the floor', () => {
    // 🔴 RED CHECK. Change `<=` to `<` in index.ts and this is the assertion
    // that fails. An off by one there reports zero waste on the exact shape the
    // file was written to catch, and reports it as a clean bill of health.
    const r = payloadPerBilledSecond(
      [{ id: 'exact', billedSeconds: 1500, bytesDelivered: 1364 }],
      { floorBytes: 1364 },
    );
    expect(r.atFloor).toBe(1);
  });

  it('does not report a free connection as infinitely wasteful', () => {
    const r = payloadPerBilledSecond(
      [{ id: 'free', billedSeconds: 0, bytesDelivered: 900 }],
      { floorBytes: 1364 },
    );
    expect(r.connections[0].bytesPerBilledSecond).toBe(0);
    expect(Number.isFinite(r.bytesPerBilledSecond)).toBe(true);
  });

  it('handles an empty set without dividing by zero', () => {
    const r = payloadPerBilledSecond([]);
    expect(r.billedSeconds).toBe(0);
    expect(r.bytesPerBilledSecond).toBe(0);
    expect(r.atFloor).toBe(0);
  });
});
