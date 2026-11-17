import { describe, it, expect } from 'vitest';
import { aliveCoverage, waitingCost, type Sample } from './index';

/**
 * The real measurement: one day of the instance count series for the service
 * that ran my timers, 2026-10-15 03:15 UTC to 2026-10-16 03:15 UTC, in five
 * minute slots, taken from the monitoring API.
 *
 * Each pair is [slot, instances]. Slot n is the five minutes ending at
 * 03:15 UTC plus n times five minutes. These are the 96 points the API
 * returned, exactly as returned. The other 192 slots of the day are not
 * missing from this file. The API returned nothing for them, and that is the
 * measurement.
 */
const RETURNED: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [8, 1], [9, 1], [10, 1], [11, 1], [12, 0], [17, 1], [18, 1], [19, 1],
  [20, 0], [21, 0], [29, 1], [30, 1], [31, 1], [32, 1], [33, 0], [36, 1],
  [37, 1], [38, 1], [39, 1], [40, 0], [46, 1], [47, 1], [48, 1], [49, 1],
  [50, 0], [53, 1], [54, 1], [55, 1], [56, 1], [57, 1], [58, 1], [59, 1],
  [60, 1], [61, 0], [69, 1], [70, 1], [71, 1], [72, 1], [73, 0], [79, 1],
  [80, 1], [81, 1], [82, 1], [83, 0], [93, 1], [94, 1], [95, 1], [96, 0],
  [97, 1], [98, 1], [99, 1], [100, 1], [101, 0], [104, 1], [105, 1], [106, 1],
  [107, 1], [108, 1], [109, 1], [110, 1], [111, 1], [112, 0], [114, 1],
  [115, 1], [116, 1], [117, 0], [118, 0], [123, 1], [124, 1], [125, 1],
  [126, 1], [127, 0], [149, 1], [150, 1], [151, 1], [152, 1], [153, 0],
  [166, 1], [167, 1], [168, 1], [169, 2], [170, 1], [171, 1], [172, 1],
  [173, 0], [272, 1], [273, 1], [274, 1], [275, 1], [276, 0], [282, 1],
  [283, 1], [284, 1], [285, 1], [286, 0],
];

const PERIOD = 5 * 60 * 1000;
const START = Date.parse('2026-10-15T03:15:00Z');
const END = Date.parse('2026-10-16T03:15:00Z');
const DAY = { start: START, end: END, periodMs: PERIOD };

const samples: Sample[] = RETURNED.map(([slot, instances]) => ({
  at: START + slot * PERIOD,
  instances,
}));

describe('alive coverage', () => {
  it('reproduces the day that was published', () => {
    const r = aliveCoverage(samples, DAY);

    expect(r.slots).toBe(288);
    expect(r.returned).toBe(96);
    expect(r.alive).toBe(76);
    expect(r.share).toBeCloseTo(0.264, 3); // 26%
    // Seventeen separate wakes, and the deploy log has a deploy a few minutes
    // before every one of them.
    expect(r.wakes).toBe(17);
    // Eight hours and fifteen minutes in which no timer could fire.
    expect(r.longestDeadSlots).toBe(99);
    expect(r.longestDeadMs).toBe(8.25 * 60 * 60 * 1000);
    expect(new Date(r.longestDeadEndedAt!).toISOString()).toBe(
      '2026-10-16T01:50:00.000Z',
    );
  });

  it('counts the slots the API was silent about', () => {
    // 🔴 RED CHECK. Change `alive / slots` to `alive / seen.size` in index.ts
    // and this is the assertion that fails. Seventy six of the ninety six
    // points returned is 79%, a service that looks mostly up. Seventy six of
    // the 288 slots in the day is 26%. The API does not return a point for a
    // period with nothing in it, so the silence is the answer.
    const r = aliveCoverage(samples, DAY);
    expect(r.shareOfReturned).toBeCloseTo(0.79, 2);
    expect(r.share).toBeLessThan(0.3);

    // The extreme of the same trap: nothing returned at all is a dead window,
    // not an empty result and not a division by zero.
    const silent = aliveCoverage([], DAY);
    expect(silent.alive).toBe(0);
    expect(silent.share).toBe(0);
    expect(silent.longestDeadSlots).toBe(288);
  });

  it('treats a point that says zero as a dead slot too', () => {
    const r = aliveCoverage(
      [
        { at: START + 1 * PERIOD, instances: 1 },
        { at: START + 2 * PERIOD, instances: 0 },
        { at: START + 3 * PERIOD, instances: 1 },
      ],
      { start: START, end: START + 3 * PERIOD, periodMs: PERIOD },
    );
    expect(r.alive).toBe(2);
    expect(r.wakes).toBe(2);
    expect(r.longestDeadSlots).toBe(1);
  });

  it('ignores points outside the window', () => {
    const r = aliveCoverage(
      [
        { at: START, instances: 5 }, // the period ending AT the start is the slot before
        { at: START + 1 * PERIOD, instances: 1 },
        { at: END + PERIOD, instances: 5 },
      ],
      DAY,
    );
    expect(r.alive).toBe(1);
    expect(r.returned).toBe(1);
  });

  it('reports a week with the minimum set as every slot alive', () => {
    // Measured after the change: 2,016 of 2,016 slots between 2026-10-21 and
    // 2026-10-28, and the same again for the week to 2026-11-17. Only the
    // count survives here. The individual values are not kept in this file,
    // so the series below is one instance in every slot, which is the least
    // the measurement allows.
    const weekStart = Date.parse('2026-10-21T00:00:00Z');
    const week = { start: weekStart, end: weekStart + 2016 * PERIOD, periodMs: PERIOD };
    const always: Sample[] = Array.from({ length: 2016 }, (_, i) => ({
      at: weekStart + (i + 1) * PERIOD,
      instances: 1,
    }));
    const r = aliveCoverage(always, week);
    expect(r.alive).toBe(2016);
    expect(r.share).toBe(1);
    expect(r.longestDeadSlots).toBe(0);
    expect(r.longestDeadEndedAt).toBeNull();
    expect(r.wakes).toBe(1);
  });
});

describe('the price of one waiting instance', () => {
  /** Cloud Run, CPU always allocated, the rates on my own bill. */
  const RATES = { cpuPerVcpuSecond: 0.000018, memoryPerGibSecond: 0.000002 };

  it('prices a day and a month of 2 vCPU and 2 GiB', () => {
    const day = waitingCost({ vcpu: 2, gib: 2, seconds: 86_400, ...RATES });
    expect(day).toBeCloseTo(3.46, 2);

    const thirtyDays = waitingCost({ vcpu: 2, gib: 2, seconds: 30 * 86_400, ...RATES });
    expect(thirtyDays).toBeCloseTo(103.68, 2);
  });

  it('costs nothing when nothing waits', () => {
    expect(waitingCost({ vcpu: 2, gib: 2, seconds: 0, ...RATES })).toBe(0);
  });
});
