# Half my connections carried nothing and still billed twenty five minutes each

> Layer: `budget`

## What happened

My cloud bill stopped tracking the work my service did and started tracking how
long people left the app open. One browser tab, holding one event stream, doing
nothing at all, cost more in an hour than every scheduled job I ran in a month.

The row that made me look was in the request log, and the number is not
approximate:

```
latency: "1500.006675772s"
```

Twenty five minutes, to within seven milliseconds. One request.

## What I assumed

That the recurring work was the expensive part. I had scheduled jobs running all
day and I was most of the way through planning a refactor to batch them, because
that is the obvious suspect when a bill keeps climbing.

Then, once I had seen the connection, I assumed I could simply delete it. A poll
already ran every twelve seconds, so the stream looked redundant. Wrong again,
and this one would have shipped: they carried different things, and deleting the
stream would have silently dropped six kinds of event the poll never asked for.
I only found that out by reading what each side actually consumed, after I had
already written the deletion.

## What was actually true

I measured one hour, taking each side of the ratio from an independent source:
the numerator from the request log, the denominator from the billing metric.

```
                            n       seconds      share
event stream                2       3,000.0      99.6%
everything else           642           8.4       0.3%
scheduled jobs             54           2.9       0.1%
summed request seconds               3,011.3
billed instance time                 3,389.0
```

Two denominators there, and they are deliberately not the same number. The
shares are of the 3,011.3 seconds the request log can account for. Billed
instance time is 3,389.0 and comes from a different API entirely. The 377.7
seconds between them is billed time that no request claims, and that gap is the
reason to take the denominator from somewhere other than your own request log.
Sum your logs and divide by your logs and you will confirm whatever you already
thought.

The refactor I was planning was worth a tenth of one percent. It was
worth less than that, actually: inside that hour the jobs were free, because
they ran during time the open connection was already paying for.

Two rows out of six hundred and ninety eight were the entire bill.

So I asked a sharper question. Not what holds the instance alive, but what those
seconds bought. Eight connections, back to back:

```
connections                              8
billed seconds                      12,000
bytes delivered                    22.6 KiB
payload per billed second        1.93 bytes
connections at the keepalive floor    4 of 8
cost                                  $0.64
```

One point nine three bytes per second, charged at the rate of real work. Four of
the eight carried nothing beyond the keepalives and headers an empty connection
sends anyway, and each of those still billed twenty five minutes.

Here is the part I did not want to write. The twenty five minute cap was not a
bug. Someone chose it and left a comment explaining why, and the reasoning was
sound: the platform cuts the stream at around thirty minutes and logs a
truncation error, so closing early gives a clean reconnect and a clean log. The
code optimised for readable logs while the meter charged for elapsed time.

## What I changed

The low frequency events now ride the poll that was already running, and the
stream opens only while something live is streaming. Worst case, an event
arrives up to twelve seconds later than it used to, and only while the app is
idle. Nothing stopped arriving. Arrival time changed, arrival did not.

Two things about where that sits.

I put the fix at the budget layer rather than the transport layer above it,
where the obvious move was a shorter lifecap. A shorter cap makes each
connection cheaper and changes nothing about the shape, because an idle client
still pins an instance, just in smaller pieces. The cost was never the length of
one connection. It was that an idle connection was billed at all.

And the switch is read from the server at startup, so reverting is one
environment variable and no application release. I built it that way because I
could not prove the poll carried everything the stream did until it ran in
production, and a change I cannot undo in seconds is a change I should not ship.

## What generalises

Request counts are not a cost signal when your provider bills elapsed time. No
amount of staring at request volume would have found this, because by volume the
expensive thing was a rounding error: two rows in six hundred and ninety eight.
Measure the ratio instead. Bytes delivered per billed second turns "this
connection is open" into "this connection is open and carrying nothing", and
those are different problems with different fixes.

The uncomfortable half is the cap. Every line of that code was correct and the
comment above it was right. The mistake was the axis it optimised for, which is
exactly the kind of mistake that survives review, because there is nothing in
the diff to object to. When a bill surprises you, the question is not which line
is wrong. It is which number the code was written to make smaller, and whether
that is the number you are paying for.

## The queries

Both sides of every ratio above, so the numbers can be checked rather than
believed. The numerator is the request log, the denominator is a different API
entirely. Divide request seconds by request seconds and you will prove whatever
you already believe.

```
GCP_PROJECT=your-project SERVICE=your-service STREAM_PATH=/your/stream \
  ./measure.sh 2026-08-12

GCP_PROJECT=your-project SERVICE=your-service ./billable.sh 2026-08-12
```

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts) · Queries: [`measure.sh`](measure.sh), [`billable.sh`](billable.sh)
