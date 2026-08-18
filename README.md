# agent build log

A running log of what I hit while building AI agents day to day.

Not tutorials. Each entry is one thing that broke in production, written down
the same way every time: what happened, what I assumed, the measurement that
settled it, what I changed, and what generalises.

Every number and error string in here was copied out of a real log.

## Why it is shaped like this

Most agent content is opinion. This is not. The claim in each entry is backed
by either a token count, an HTTP response, or a test you can run.

Each entry ships with standalone code and a test. No dependency on my product,
so you can lift a file and use it.

## Entries

| Layer | Entry | What broke |
|---|---|---|
| wire | [tool call as text](notes/wire/tool-call-as-text) | the model wrote the call out instead of emitting one |
| budget | [keepalives at full price](notes/budget/keepalives-at-full-price) | half the connections carried nothing and still billed twenty five minutes each |
| budget | [the same bill under a different name](notes/budget/the-same-bill-under-a-different-name) | the fix worked, and 97% of what was left was the same pattern on another connection |

_(more as they happen)_

## Layers

The spine is where a failure lives, not when it happened.

- **wire**: the shape the model actually returns
- **arguments**: what travels inside a call, and back again as history
- **loop**: deciding whether a turn is finished
- **budget**: tokens, and who gets to spend them
- **surface**: how many tools the model can actually see
- **prompt**: instructions that cannot all be obeyed
- **transport**: getting the result to a person

## Adding an entry

Copy `_template/`, rename it under the right layer, fill in the five sections,
write one test. About fifteen minutes. If it takes longer than that the entry
is trying to be two entries.

## Licence

MIT. Lift anything.
