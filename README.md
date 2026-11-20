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
| budget | [the same bill under a different name](notes/budget/the-same-bill-under-a-different-name) | the fix worked, the bill fell short of it, and the shortfall was a second connection |
| loop | [the limit the user read](notes/loop/the-limit-the-user-read) | two counters disagreed about the same instant, and the refusal reached the user as prose |
| budget | [the jobs that were asleep](notes/budget/the-jobs-that-were-asleep) | timers inside a service that scaled to zero ran in a quarter of the day, and keeping them awake became the largest line on the bill |
| prompt | [the schema the tool could not read](notes/prompt/the-schema-the-tool-could-not-read) | the prompt described the database with the application's rights, the tool queried with its own, and what the prompt taught was refused |
| eval | [the judge that could not see the failure](notes/eval/the-judge-that-could-not-see-the-failure) | the judge listed the wrong answers I had thought of, a reply in a script that was not on the list passed, and the score went up while the product got worse |

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
- **eval**: deciding whether an answer was right

## Adding an entry

Copy `_template/`, rename it under the right layer, fill in the five sections,
write one test. About fifteen minutes. If it takes longer than that the entry
is trying to be two entries.

## Licence

MIT. Lift anything.
