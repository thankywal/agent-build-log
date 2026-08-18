# I fixed it, measured a 75.6% drop, and the same thing was still running

> Layer: `budget`

## What happened

I had spent a week on one connection that was holding a serverless instance
open and billing for every second of it. I shipped the fix, measured the same
clock hour three days later with the same method, and the bill for that hour
went from eighteen cents to four.

```
billed instance time    3,389.0 s  ->  826.1 s     (75.6% less)
the connection I fixed  3,000.0 s  ->  endpoint unused
```

Then I looked at what was left, and 97% of it was the same pattern running on a
different connection.

## What I assumed

That a large drop is evidence the problem is gone. It is not. It is evidence
that one instance of the problem is gone, and those two look identical from the
headline.

I also assumed I had a full picture of the hour, because I had a table with
every request in it. I did have every request. One row of that table was called
"everything else", I had never opened it, and by the end of this it was the
entire bill.

## What was actually true

Here are both hours, same clock window, three days apart.

```
before                    n     seconds        after                   n     seconds
event stream              2     3,000.0        everything else       550       807.5
everything else         642         8.4        scheduled jobs         54         2.7
scheduled jobs           54         2.9        event stream          240         1.5
summed                        3,011.3        summed                           811.7
billed                        3,389.0        billed                           826.1
```

The thing I set out to kill is dead. That row is still there and now carries 240
ordinary polls in a second and a half. The bucket I never looked at went from
8.4 seconds to 807.5, which is 99% of every request second that remained.

So I split it, and there was a second connection doing exactly what the first
one did. Eight requests, six sessions, 787.2 seconds, 97.0% of the 811.7
request seconds that were left. Its own comment in the source describes it as a lightweight listener
kept open while a screen is open, waiting for one event that is a refetch
trigger and nothing more.

Three checks before I would believe it. No agent turn ran in that whole hour, so
none of it was real work. The only other traffic was the poll and me switching
between screens. And the app polled without a break from 13:30:06 to 14:21:11,
so the app was open about as long as it had been three days earlier and the
comparison is fair.

For the first forty minutes of that hour the app sat holding nothing and cost
1.5 seconds. Then a screen opened, and the meter went back to what it had been.

## What I changed

Not the code, yet. What I changed first was how I verify a fix, because the code
change I was about to make was the same one I had just made, and I would have
shipped it believing it was finished for the second time.

The rule now: after a fix, measure the same window with the same method, and
attribute the remainder before touching anything. Not the delta, the remainder.
`index.ts` is that step. Give it both windows and it returns every surviving
bucket's share of what is left, largest first, and names the one that dominates.

I put it at the budget layer rather than one above because the failure is not in
any connection. Either connection, on its own, is a defensible piece of code. The
failure is that I had a mechanism for making a connection cheap, applied it to
one door, and never asked how many doors there were.

One thing the file refuses to do, deliberately. A bucket that was not measured
in the before window comes back as `null`, not zero, and can never be reported
as having grown. I wanted to write that the second connection had been hiding in
the numbers all along. The measurement does not show that. It shows the bucket
was 8.4 seconds and then it was 807.5, and I cannot tell from this alone whether
it grew or whether it had always been there and the bigger number was drowning
it. So the code will not say.

## What generalises

A percentage drop is not a verdict. It tells you an instance is gone and says
nothing about the pattern, and the two are indistinguishable until you decompose
what survived. Measure the remainder, not the improvement.

The other half is smaller and I think more useful. Every measurement I take has
a bucket called "everything else", and I have never once opened it, because by
definition it is the part I decided was not interesting. That is precisely why
the next thing lives there. A bucket you named after your own lack of interest
is not a measurement, it is a place to put things you have stopped looking at.

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts) · Queries: [`measure.sh`](../keepalives-at-full-price/measure.sh), [`billable.sh`](../keepalives-at-full-price/billable.sh), run once per window
