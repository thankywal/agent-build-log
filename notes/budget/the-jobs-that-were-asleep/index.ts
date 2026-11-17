/**
 * Alive coverage, and the price of keeping one instance waiting.
 *
 * This exists because a service of mine measured as free and was in fact
 * asleep. It ran timers: posts due at a set time, reminders, retries. Nothing
 * ever sent it a request, so on a platform that scales to zero it woke only when
 * a deploy started it, stayed up about a quarter of an hour, and went away with
 * every timer inside it. The bill for that was close to nothing, and I read
 * close to nothing as cheap.
 *
 * Feed it the instance count series for a window. It gives back the share of
 * slots in which at least one instance existed, and the longest silence. The
 * part that matters is the denominator: a monitoring API returns no point at all
 * for a period in which there was nothing to count, so the slots it is silent
 * about are the finding, and dividing by the points it did return hides them.
 *
 * No imports beyond the standard library. Lift the file.
 */

export interface Sample {
  /** End of the sampling period this point covers, in epoch milliseconds. */
  at: number;
  /** Instances that existed in that period. Zero is a real answer. */
  instances: number;
}

export interface Window {
  /** Epoch milliseconds. */
  start: number;
  /** Epoch milliseconds. */
  end: number;
  /** Length of one slot. Use the alignment period you queried with. */
  periodMs: number;
}

export interface CoverageReport {
  /** Slots the window holds, whether or not the API said anything about them. */
  slots: number;
  /** Slots in which at least one instance existed. */
  alive: number;
  /** alive over slots. The number to publish. */
  share: number;
  /** Slots the API returned a point for. */
  returned: number;
  /**
   * alive over returned. Kept only so the trap is visible next to the answer:
   * it ignores every slot the API was silent about.
   */
  shareOfReturned: number;
  /** Separate stretches of being awake. */
  wakes: number;
  /** Longest unbroken run of slots with no instance. */
  longestDeadSlots: number;
  longestDeadMs: number;
  /** When that run ended, in epoch milliseconds. Null when nothing was ever dead. */
  longestDeadEndedAt: number | null;
}

export function aliveCoverage(
  samples: readonly Sample[],
  window: Window,
): CoverageReport {
  const slots = Math.max(
    0,
    Math.floor((window.end - window.start) / window.periodMs),
  );

  // Slot i covers (start + (i - 1) * period, start + i * period]. A point is
  // stamped with the END of its period, so a point stamped exactly at the window
  // start belongs to the slot before the window and is left out.
  const seen = new Map<number, number>();
  for (const s of samples) {
    const slot = Math.ceil((s.at - window.start) / window.periodMs);
    if (slot < 1 || slot > slots) continue;
    seen.set(slot, Math.max(seen.get(slot) ?? 0, s.instances));
  }

  let alive = 0;
  let wakes = 0;
  let dead = 0;
  let longestDeadSlots = 0;
  let longestDeadEndedAt: number | null = null;
  let wasAlive = false;

  for (let slot = 1; slot <= slots; slot++) {
    // A slot with no point and a slot whose point says zero are the same fact.
    const isAlive = (seen.get(slot) ?? 0) >= 1;
    if (isAlive) {
      alive++;
      if (!wasAlive) wakes++;
      dead = 0;
    } else {
      dead++;
      if (dead > longestDeadSlots) {
        longestDeadSlots = dead;
        longestDeadEndedAt = window.start + slot * window.periodMs;
      }
    }
    wasAlive = isAlive;
  }

  return {
    slots,
    alive,
    // Over the slots of the window, never over the points returned. Divide by
    // `seen.size` here and a service that was up for a quarter of the day
    // reports as up for most of it.
    share: slots > 0 ? alive / slots : 0,
    returned: seen.size,
    shareOfReturned: seen.size > 0 ? alive / seen.size : 0,
    wakes,
    longestDeadSlots,
    longestDeadMs: longestDeadSlots * window.periodMs,
    longestDeadEndedAt,
  };
}

export interface WaitingInstance {
  vcpu: number;
  gib: number;
  /** How long it is kept waiting. */
  seconds: number;
  /** Your provider's rate for CPU that stays allocated, per vCPU second. */
  cpuPerVcpuSecond: number;
  /** And for memory, per GiB second. */
  memoryPerGibSecond: number;
}

/**
 * What it costs to keep one instance waiting with its CPU allocated. This is the
 * other side of a number that measures zero: the price of the work actually
 * running.
 */
export function waitingCost(i: WaitingInstance): number {
  return (
    i.seconds *
    (i.vcpu * i.cpuPerVcpuSecond + i.gib * i.memoryPerGibSecond)
  );
}
