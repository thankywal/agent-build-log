# The model read my rate limit out to the user

> Layer: `loop`

## What happened

Someone asked the agent for a promotional image. They got no image. What they
got, in the middle of the reply, was this:

```
the system says I must not retry send file to chat again this turn
```

That sentence is mine. It is a refusal my loop returned to the model when the
same call came round twice, and the model, having nowhere else to put it, handed
it to the person who was waiting for a picture. Fifty tool calls. Two million
four hundred and seventy six thousand input tokens. Five and a half minutes. No
image.

## What I assumed

That a model repeating itself is a model that needs to be stopped. So I counted
repeats and I refused the call, and I believed the refusal was the safety
feature. When the refusal turned up in a user's chat I reached for a second
mechanism to keep the first one quiet, which is the moment somebody told me I
was patching a punctured tyre rather than asking why it kept going flat.

I also published a headline before I had checked it. I said my system prompt
carried five hundred and twenty seven prohibitions against another harness's
thirty three. That count had swept up my own code comments and test fixtures.
The honest number is one hundred and seventy against sixty one. Three times, not
sixteen. I corrected it in the same repo before anyone asked, and it is in here
because the wrong number is the more useful half of the story.

## What was actually true

Two counters, in two files, watching the same two failures, reached opposite
verdicts in the same instant. One had decided the call was a repeat worth
blocking. The other had not seen a repeat at all, because it keyed the call
differently. Neither was wrong about its own bookkeeping. There was no single
place that could be asked what had happened this turn.

Then I read three other agent harnesses. One appends a reminder at the third,
fifth and eighth identical call and lets the call run. One has no repeat guard at
all. One resamples twice and accepts the answer. None of them blocks a call, and
not one has a mechanism that forces a specific tool.

That is the sentence that turned the week around. Force is why I needed brakes.
The brakes are what the model spent fifty calls fighting.

Same prompt, three runs on one day at 06:43, 10:16 and 12:14 UTC, each after a
fix, with the loop's own telemetry on every run:

```
                     before          middle           after
tool calls               50              20               8
input tokens      2,476,107         906,251         350,969
duration               338s            149s             73s
outcome            no image       delivered       delivered
```

Eighty six percent fewer tokens, and the run that spent the least is the one
that produced the thing that was asked for.

## What I changed

One append only record per turn. Every call that is dispatched writes one row to
it, and every counter that used to hold its own number became a view that reads
those rows. Repeats, failures, whether anything new happened: all of them are
questions asked of the same record, so two of them can no longer disagree about
the same instant.

Then the refusals became advice. Past a threshold the record adds a line saying
the call has now run this many times with these arguments, and the call still
runs. What bounds a turn is what always genuinely bounded it: the call ceiling,
the wall clock, and the money.

I considered the narrower fix, which was to make the two counters agree by
keying them the same way. I rejected it because it leaves two counters. The next
person to add a third would have had no way to know which one was authoritative,
and neither did I.

## What generalises

If two counters in your system can look at the same moment and reach different
verdicts, they are not counters. They are opinions, and you are running on
whichever one happens to be read first. Keep one record of what actually
happened and make every count a view over it. Separately: a limit the model has
to fight becomes text your user reads. Enforcement inside an agent is not free
and it is not invisible, so before you add one, check whether information would
have done the job. Three harnesses I compared had already answered it: none of
them blocks a call and none forces a tool.

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts)
