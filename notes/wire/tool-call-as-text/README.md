# The model wrote the tool call out as text instead of emitting one

> Layer: `wire`

## What happened

An agent turn did nothing at all. No tool ran, no error was raised, and the
reply was a wall of markup the user was never meant to see.

Every model API gives you a structured field for tool calls. This one ignored
it and hand wrote the call into `content`:

```
<｜DSML｜invoke name="exec_bash">
<｜DSML｜parameter name="command">psql -c "select …
```

## What I assumed

That this was malformed output and the right move was to reject it, log it, and
count it as a failed turn. It is malformed, technically.

I also assumed the delimiter was the pipe character on my keyboard, wrote a
regex against `|`, and spent an hour wondering why it never matched anything.

## What was actually true

Two things, and both changed the fix.

The delimiter is not ASCII `|`. It is FULLWIDTH VERTICAL LINE, `U+FF5C`. They
render close enough that reading the source will not tell you.

```
'|'.charCodeAt(0)   // 124   the one on your keyboard
'｜'.charCodeAt(0)   // 65372 the one in the payload
```

And the block is almost always truncated, because writing all that markup burns
the same output budget the actual work needed. A complete one is the exception.

So rejecting these was not a neutral choice. The model had told me exactly which
tool it wanted and most of what to pass. Refusing that is choosing to fail a
turn I could have completed.

## What I changed

A recovery parser at the provider seam, deliberately forgiving:

- pull out every `invoke` marker, not just the first
- treat everything up to the next marker as that call's body
- let the last parameter run to the end of the buffer, because a half written
  call is still the call the model meant to make

Strictness belongs one layer further in, where I own both sides of the
interface. Not here.

## What generalises

The seam that touches a language model is not a place for a strict contract. It
is a place for a good recovery. Validate hard where you control both ends;
be generous exactly where you do not.

And when a regex against model output matches nothing, check the code points
before you check your pattern.

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts)
