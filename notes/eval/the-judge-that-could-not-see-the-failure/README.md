# My judge could not see the failure it was built to catch

> Layer: `eval`

## What happened

An evaluation told me a change was good. Seventy six answers right on the first
draft out of eighty, where the version in production got forty. I built the
branch on that number.

The true count was seventy one. The five it had wrong were the ones that
mattered: my change had made the agent answer an English message in Chinese, and
the judge had passed all five replies as English. This is the message and the
two answers, retyped with the product and the price replaced:

```
customer   Hi, I am 王伟. How much is the Gold Hand Chain?
before     Hello 王伟, the Gold Hand Chain is 120 USD. It is 18K gold and is available.
after      您好王伟，Gold Hand Chain（18K金手链）的价格是 120 USD，目前有货。
judge      English
```

## What I assumed

That a judge which looks for the right answer is a judge.

Mine asked two things of a reply to an English message. Are there Latin letters?
And are there no Thai, Hindi, Tamil, Burmese or Japanese letters? It even took
product names out first, so that a product quoted in English could not make a
Thai reply look English. I thought that was careful.

I did not notice that the second question was a list, and that a list has an
end.

## What was actually true

The judge was a list of the wrong answers I had thought of. Chinese was not on
it.

This is that judge, replayed on the reply above:

```
product names taken out, then letters counted by script

Latin                                     4    the K of 18K, and USD
Thai, Hindi, Tamil, Burmese, Japanese     0
Chinese                                  32    no rule
verdict                                  English
```

Four letters, from a carat mark and a currency code, were enough to call a
Chinese sentence English.

It was not one unlucky run.

```
                          reported    true
first run, 80 answers        76        71
next run, 95 answers         94        89
```

The second line is the same judge on the branch I had already built. Before the
change that message was answered in English five times out of five. After it,
in Chinese, five out of five. The score went up while the product got worse.

I found it by reading the replies. Nothing in the totals could have told me,
because the totals were the judge's own words.

## What I changed

On the day, the narrow thing. I added Chinese to the list, and I made the judge
take the customer's own name out before it counted, because greeting someone by
name is right.

Then the run. Every run now carries messages that the change could break, and
not only the ones it is meant to fix: English with a Chinese, Japanese, Thai or
Burmese name typed into it, a profile name in another script, an address in
another script. Sixteen messages became twenty eight.

That was enough to see the regression and to fix the thing itself. What
shipped, measured with the same judge on both sides:

```
                              before         after
right on the first draft    82 of 140    131 of 140
rewrites                           56             1
model calls                       339           289
```

The message with the Chinese name is answered in English again, five out of
five.

One loss is still open, and I shipped knowing it. A Thai or Burmese name typed
into an English sentence now decides the language eight times in ten, where
before it was two in ten. I can count it because the judge can see it.

It was still a list, though. A reply in a script I had not listed, with a
currency code in it, would have passed exactly as the Chinese one did. So the
code in this folder is the judge I wrote afterwards, with the rule turned
around. It does not list what is wrong. It says what a right answer is made of:
the scripts it is written in, the text that is right in any language (the
customer's own name, a product, an address), and what may sit beside them, like
a currency code inside a Chinese sentence. Every other letter makes the answer
wrong, and the verdict shows the letters.

## What generalises

A judge is an access rule for answers, and a deny list passes whatever you did
not think of. What you did not think of is what a regression looks like. So
write the judge the other way round: say what a right answer is made of, and
reject everything else. Then put into every run the cases your change could
break, and read a sample of the raw outputs before you report a total.

A score that goes up is not evidence that anything got better, until the judge
has been shown a wrong answer and has refused it.

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts)
