# The jobs that measured as free were asleep

> Layer: `budget`

## What happened

A post that was scheduled for 03:00 went out at 03:23. Nothing had failed. There
was no error, no retry and no alert. The post left twenty three minutes late
because at 03:00 the process that sends scheduled posts did not exist.

```
due      2026-10-16 03:00:00 UTC
deploy   2026-10-16 03:21:39 UTC   an unrelated release
sent     2026-10-16 03:23:11 UTC
```

The deploy fixed nothing. It started the service, and the service, now awake,
noticed that it was late.

## What I assumed

That a line which measures zero has nothing to tell me.

This log started with me being wrong about scheduled jobs in the other
direction. I was sure they cost about forty dollars a month and they cost
fifteen cents. When I listed the lines I would work through, the second was
serverless minimum instances: what I pay to keep an instance waiting. I measured
it in August. None of my services kept one waiting, the answer was zero, and I
wrote it down as a line with nothing behind it.

So once the fifteen cents had turned out to be true, I let it stand for every
scheduled job I ran. It was true of every scheduled job I could see.

## What was actually true

I have two kinds of scheduled work and I had only ever measured one.

The jobs in the first entry are requests. A scheduler calls an endpoint, the
platform starts an instance if it needs one, the work runs, and the request sits
in the log with a latency I can add up. The other kind are timers inside a
different service: posts due at a set time, reminders, retries. Nothing ever
sends that service a request. Its timers do not arrive from anywhere. They wait
inside the process for the process to be awake.

On a platform that scales to zero, that service was awake only when something
started it, and the only thing that ever started it was me shipping code. One
day of its instance count, in five minute slots, from the monitoring API:

```
window                2026-10-15 03:15 UTC to 2026-10-16 03:15 UTC
slots in the window                  288
points the API returned               96
alive                                 76     26%
separate wakes                        17
wakes with a deploy just before       17 of 17
longest silence                    8h15m     17:35 to 01:50 UTC
```

Seventeen times that day the service woke, stayed fifteen or twenty minutes past
the last deploy, and went away with every timer inside it. Each of the seventeen
follows a deploy in the audit log by a few minutes. On a day when I shipped
nothing, there would have been nothing to wake it.

The first number I computed was wrong, and it is why the code in this folder
exists. The API returned 96 points and 76 of them showed an instance. That is
79%, a service that is mostly up. But the API does not return a point for a
period in which there was nothing to count. The 192 slots it said nothing about
are not missing data. They are the measurement. Seventy six of 288 is 26%.

And these jobs were never cheap the way the request jobs are cheap. A timer gets
no CPU between requests unless the CPU stays allocated, so that service was
billed for every second it was up, working or not. The bill was small because
the service was mostly not there.

## What I changed

I set the minimum to one instance on that service the same day, and measured
again with the same script.

```
                                 before             after
alive, five minute slots      76 of 288    2,016 of 2,016
a post due at 03:00            03:23:11          03:00:51
                                                 03:00:37
CPU kept allocated, a day   19.8 vCPU h       53.5 vCPU h
```

The after column is a week of slots from 21 October, the next two posts in the
same 03:00 slot, and the thirty days to 16 November. The before column for CPU
is the first ten days of October.

Then the other meter. One instance of 2 vCPU and 2 GiB, kept waiting at the
rates on my bill, lists at $3.46 a day. The bill agrees with the price list. For
the thirty days to 16 November the line for CPU that stays allocated was
$104.03 and the memory line beside it $10.95. The waiting instance is 48 of the
53.5 vCPU hours a day on those lines, so about $104 of the $115 is that one
instance. The next largest line on the whole bill is $35.28.

That is more than the forty dollars I was once afraid of, and I would make the
same call again. A post that goes out late is a broken promise to whoever
scheduled it.

I considered the narrower fix, and it is the right one eventually: turn each
timer into a request, the way the jobs in the first entry already work, so that
a scheduler wakes the service only when there is something to do. I did not take
it because one queue consumer lives in the same service and it is not a timer.
Moving the timers alone would not take the minimum back to zero. That makes it a
redesign of the service and not a patch to it, so this line stays open.

## What generalises

Scale to zero is free for work that arrives as a request. A timer does not
arrive. Before you read a small number on a bill as cheap, find out which of two
things you are looking at: something that costs little, or something that is
mostly not running. They produce the same bill and opposite outcomes.

The same trap sits inside the measurement. A monitoring series has no row for
nothing. Divide by the points that came back and you are measuring the service
only while it exists, which is the one condition under which it always looks
healthy. Count the slots in the window yourself, and treat silence as a zero.

## The queries

The instance count comes from the monitoring API and the money from the billing
export. Two sources that do not know about each other.

```
GCP_PROJECT=your-project SERVICE=your-service \
  ./alive.sh 2026-10-15T03:15:00Z 2026-10-16T03:15:00Z

bq query --nouse_legacy_sql < billing.sql
```

One note on the evidence. The three send times above were read from the service
log on 29 October. That log keeps thirty days, so those lines are gone and I
cannot show them to you again. The deploy time comes from the audit log, which
keeps longer, and the day of instance counts is in the test, point for point.

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts) · Queries: [`alive.sh`](alive.sh), [`billing.sql`](billing.sql)
