# How to keep me from dropping items in long, multi-part prompts

This is what consistently fails on long prompts (10+ enumerated items
delivered in a single voice/text message), why it fails, and the workflow
that has actually held in this project.

## What goes wrong

1. **I read the prompt once and lose granularity.** When you list 18 items
   in dictation form, my parse compresses them into 5–6 themes. The
   specific items that don't fit a theme silently disappear.
2. **Compaction eats partial state.** If I'm 10 items in and the model
   conversation gets compacted, the summary keeps 2–3 of the most recent
   items and loses the rest unless they're written somewhere durable.
3. **I claim things "done" without verifying every item.** A theme-level
   check ("light mode is fixed") hides per-item failures (energy
   sheet OK, stress sheet broken).
4. **I batch verification.** I make 6 changes, then snapshot once, then
   miss what didn't change. By the time I notice, I can't easily isolate
   which change broke what.

## What you can do (one-time, when you give me a long prompt)

**Tell me to dump the items into a file before doing any work.** One line:

> First, before any code, write every item from this prompt into
> `CURRENT-TASK.md` as a numbered list. Then start the TodoWrite list
> from that file. Don't begin work until that file is written.

This forces me to enumerate explicitly. The act of writing each item to
disk is what catches the ones I would otherwise drop. Once it's in
`CURRENT-TASK.md` AND in TodoWrite, both survive compaction and I have
to revisit them.

**Tell me to verify per-item, not per-theme.** One line:

> After each item, screenshot or run the verifier specific to that item
> before marking it complete. Do not batch verification.

This stops the "light mode is done" theme-level claim that hides the
broken stress sheet.

**Cap dictation at ~5 items per turn if you can.** Long voice transcripts
are the worst case for my parser — punctuation is ambiguous, items run
together, and I lean on thematic grouping that loses specifics. Five-
item bursts with "and that's the batch — confirm them back" let me
re-read each one before acting.

## What I should be doing automatically (and didn't, before)

These are the rules I now have in CLAUDE.md / memory and should follow
from the start of any long prompt:

1. **Write `CURRENT-TASK.md` with all items, in order, before any code.**
   Both for me (durable across compactions) and for you (you can
   re-paste if I drift).
2. **Build the TodoWrite list from the file.** One todo per numbered
   item. Each todo is small enough that "completed" is unambiguous.
3. **Read back the list explicitly.** Before starting, summarize the
   N items I'm about to work on. If anything looks wrong, you can
   correct me before I commit to a wrong interpretation.
4. **Verify per-item.** Screenshot or test after each change. Mark the
   todo complete only after the verifier passes.
5. **Re-anchor on every compaction resume.** Read `CURRENT-TASK.md` first
   on resume, before reading anything else. The file lists what's done,
   what's pending, and the next exact command.
6. **Surface dropped items proactively.** If, mid-work, I realize an item
   from the original list was never put in TodoWrite, stop and add it
   immediately rather than rationalizing why it doesn't matter.

## What kept failing in this session and why

The light-mode pass was a 17-item dictated prompt. I:

- Built a TodoWrite list, but with 6 items instead of 17, because I
  collapsed several items under "light mode contrast pass" without
  enumerating them.
- Verified energy rating sheet visually and called the rating-sheet item
  done — even though stress sheet had a different layout bug that the
  energy screenshot didn't expose.
- Claimed "the alias bug is fixed" after one targeted change, then
  noticed the same alias bug elsewhere later because I hadn't grep'd
  for all usages first.
- Lost specific items (raw diagnostics removal, collapse text style,
  back-to-battery sticky) across one compaction event, and you had to
  re-list them.

The fix that actually worked was creating `CURRENT-TASK.md` with the
full enumerated list, then a per-item TodoWrite list, then per-item
screenshot verification with `node snap-audit.js` after each change.
That's the workflow this doc encodes.

## tl;dr

If you give me a long prompt and want it not dropped:

> Write every item into CURRENT-TASK.md first, build a TodoWrite from
> that file, verify each item with a screenshot before marking it done,
> and re-read CURRENT-TASK.md after any compaction.

Pin that line. If I deviate, point at it.
