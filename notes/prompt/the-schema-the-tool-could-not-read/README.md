# The prompt showed the model a database its tool could not read

> Layer: `prompt`

## What happened

Someone asked the agent to check all of their business data and send back the
analysis as a PDF and a spreadsheet. They got neither. The reply ended like
this:

```
I could not complete this task. An operation failed, so work has stopped.
```

Eleven model calls, fourteen tool calls, 713,638 input tokens, ninety six
seconds, no file.

In the log the model is trying to count one thing, the rules each shop has, and
it asks four times. Every attempt is refused. These lines are retyped with my
own table and column names replaced:

```
ERROR:  column "shop_name" does not exist
ERROR:  column s.id does not exist
ERROR:  column r.shop_name does not exist
ERROR:  column "shop_name" does not exist
```

One note on the evidence. My log keeps only the first few hundred characters of
each result. The first three lines are read from it. The fourth is cut off
there. What the log does keep is the query, which is the first one sent again,
and its exit code, which is 1.

## What I assumed

That the cheaper model had ignored the schema I gave it.

The prompt carries a compact card of the database, every table with its columns,
and an instruction to write SQL straight against the card and not to go
exploring. The turn that failed ran on my cheaper tier. Forty minutes later I
sent the same sentence on the dearer tier and it finished, with both files.

That looked like proof. A weaker model, a schema it had not read carefully, a
few bad joins. My first account of the failure said so, with the word likely in
it more than once, and I was told to stop guessing and go and look.

## What was actually true

The card was right about the database and wrong about the model's view of it.

The application builds the card, with the application's rights, so it lists
every table and column that the owner of the data can see. The model does not
query with those rights. Its SQL tool connects with a narrower role that sees a
set of views: each table carries the shop's name, the internal ids that tie a
row to its owner are hidden, and a few configuration tables are closed to it
altogether.

So the card showed an id on the shops table and a rules table keyed by it. The
model wrote what the card taught. From where the tool stands that id is not
there, and neither is a name column on the rules table, which it may not read in
the first place. So the role refused the first query, then the join, then the
join by name, then the first query again. The model did what the prompt said.
The prompt described a database the tool could not read.

Same sentence, three runs, one day:

```
                       cheaper tier     dearer tier    cheaper tier
                             before          before           after
model calls                      11              13              15
tool calls                       14              13              18
input tokens                713,638       1,103,305       1,083,303
duration                        96s            119s            127s
failed tool results               6               1               1
outcome                     no file       two files       two files
```

Read the first column against the third. The run that failed is the cheapest of
the three. Counted per run, the fix made the turn dearer. Counted per delivered
report, the first column is the one with no price at all, because 713,638 tokens
bought nothing.

The dearer tier did not pass because it reads a schema better. It never asked
the question that needed the join. It stayed on tables whose columns look the
same from both sides, and that pass is what made the wrong theory feel proven.

What I cannot claim. This is one run on each side, and that day I shipped six
changes, not one. Of the six failed results in the first run, four were the
question above, one was the sandbox, and one was a mistake in a script the model
wrote.

What I can claim is narrower, and it needs no statistics. Four refused queries
asked for a column or a table that the card showed and the tool's role cannot
read. That is true by construction, on every run, for every model. In the run
after the change the model wrote eight queries, each keyed on the column the
tool can see, and the one that failed guessed a column the card had never
listed.

## What I changed

The card is now read from where the tool reads: the columns visible to the role
the tool connects with, and no longer the columns visible to the application.
Two lines sit under it that a column list cannot say: which column joins every
table, and which tables are closed to the tool and where their counts come from
instead.

I considered the narrower fix, which was a sentence in the prompt telling the
model not to join on the id. I rejected it because it leaves two descriptions of
one database, kept in agreement by hand. The next hidden column would have
produced the same turn.

The code in this folder is the check I did not have. Give it the card and the
columns the tool can select, and it names everything the card shows that the
tool cannot read. The only acceptable answer is an empty one.

## What generalises

Whatever you tell a model about its tools has to be produced by asking the tool,
with the tool's own rights, and not by asking the system the tool sits in front
of. A schema, a file listing, a list of permissions: each has an owner's view
and a tool's view, and every difference between the two is a call the model will
make and the tool will refuse. The model pays for that in calls and the person
pays for it in tokens.

Then the cheaper model takes the blame, because a dearer one happened to walk a
different path. When a cheap tier fails and a dear tier passes the same prompt,
look at what each one asked for before you decide which one is cleverer.

---

Code: [`index.ts`](index.ts) · Test: [`index.test.ts`](index.test.ts)
