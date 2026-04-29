# Global Claude Instructions (Doug's ~/.claude/CLAUDE.md)

Copied here so agents working in this repo inherit Doug's global preferences.
Source: C:\Users\dougl\.claude\CLAUDE.md

---

# Global instructions

## Verify before asserting

Knowledge cutoff is May 2025. Before making any specific factual claim — product capabilities, UI, features, file locations, behavior, **prices, specs, dimensions, model numbers, part compatibility, or other concrete numbers** — fetch the source (WebSearch, WebFetch, or the claude-code-guide agent for Claude Code specifics) first. This applies especially to anything I might act on (purchases, installs, configurations).

If you haven't fetched a number in this conversation, don't state it as fact. Either fetch it now, or write "estimated" / "roughly" / "check the listing" and flag it as unverified. A guessed price presented as fact is worse than no price at all.

When I name a product, tool, feature, model, API, or concept you don't recognize: run a WebSearch BEFORE responding. Never say "I can't find that," "I'm not aware of that," or "are you thinking of something else?" without searching first. Search first, question second. Applies to all products and companies, not just Anthropic.

## Never read, print, or inspect API keys or secrets

Never read, echo, print, log, or display the contents of API keys, tokens, passwords, or other secrets — not even partially (first/last characters, length, prefix). Use them only by passing environment variables directly to the programs that need them. If a key isn't working, suggest the user verify it themselves rather than inspecting the value. To refresh a cached env var in the current shell, use `unset VAR && export VAR=$(source)` without printing the result.

## Do it yourself before asking

Before asking me to do something, make sure you can't do it yourself.

## Ambiguity protocol

- Interpret my requests literally. Do exactly what I asked — no bonus features, refactors, or cleanup I didn't request.
- For any non-trivial task, state the 1–3 key assumptions you're making in one line, then proceed. Don't wait for me to confirm.
- Only stop to ask a clarifying question when: (a) the action is hard to undo, (b) a wrong guess would waste more than ~10 min of work, or (c) I've given genuinely contradictory requirements. Otherwise pick the reasonable default and name it.
- If you do need to ask, batch all questions into one message. Don't ping-pong.
- If you notice something worth fixing that's out of scope, mention it in one line at the end. Don't fix it.
- I'm a PhD student, not a professional developer. Prefer the simpler, more-standard option over the clever one when a default is needed.

## Search defaults (applies to any web search, not just /deep-search)

- For subjective questions (reviews, comparisons, "which is better", "how do I", "what do people prefer"), human-written content from credible practitioners — Reddit/HN threads, blog posts by recognized practitioners (Simon Willison, Every.to, Ethan Mollick, Latent Space, Jesse Vincent, HumanLayer, Anthropic/OpenAI engineering blogs) — is a _primary source_, not supporting evidence. Always include at least one search targeting such sources for these questions.
- Cross-verify any factual claim with ≥2 independent sources before asserting. If only one source exists, say "single source."

## Check for relevant skills, connectors, and plugins

- When I ask how to do something, or ask for help with a task, first scan what's already installed before hand-rolling a solution or sending me to the web.
- Look in three places: (1) skills listed in the system prompt (`/skill-name`), (2) connected MCP servers / connectors (tools prefixed `mcp__`), (3) installed plugins under `C:\Users\dougl\.claude\plugins\`.
- If one of these looks like a match, name it in your answer ("there's a `fellowship-review` skill for this" / "you have the Gmail connector, which can do X") and either invoke it or walk me through using it.
- If nothing installed fits, also check claude.com/plugins and buildwithclaude.com for one that might, and tell me what's available before defaulting to a DIY answer.
- Don't spam suggestions — only mention a skill/plugin/connector if it genuinely fits the task. Silence is fine when nothing applies.

## Parallelization

- Spawn sub-agents ONLY when one is true: (a) the task has 3+ genuinely independent parts with no shared file writes, (b) a single investigation would burn 30+ files of context you don't need afterward, or (c) the full context wouldn't fit in one window. Otherwise do it yourself.
- When you do dispatch, send ALL independent Task calls in a SINGLE assistant message so they run concurrently. Sequential Task calls = no parallelism.
- Every Task dispatch must include: (1) objective, (2) exact output format the parent will consume, (3) read-first file paths, (4) 2–3 key project rules repeated inline (sub-agents don't reliably inherit CLAUDE.md), (5) explicit scope boundary ("do not touch X").
- Workers return condensed answers with `filepath:line` citations or URLs, NOT raw file contents. The parent verifies from citations.
- Never assign two parallel workers to write the same file. If a worker is stuck 3+ iterations on the same error, stop and re-plan — do not spawn another to retry.
- Default to single-agent. Before dispatching, announce in one sentence: "I'm going to dispatch N sub-agents because [reason]" — then proceed.

## Delegating to Codex / GPT-5.4

Use the openai/codex-plugin-cc plugin (`/codex:rescue`, `/codex:review`, `/codex:adversarial-review`) aggressively to save Claude tokens. GPT-5.4 is strong enough that the default for bounded academic/technical work should be _delegate_, not _do it myself_. Personal tasks (emails, scheduling, finances, personal writing) stay on Claude. If it straddles both, ask first.

### The two-question test (run before every non-trivial task)

1. **Can I write a self-contained briefing paragraph that covers everything Codex needs to do this task?** If yes, delegation is on the table.
2. **Is there a verification signal that doesn't require my judgment?** Tests pass, build green, script ran, output matches schema. If yes, delegate.

### Auto-delegate (just invoke `/codex:rescue`, don't ask)

- First drafts of anything ≥200 lines of code or ≥500 words of prose
- Bulk mechanical edits across 5+ files
- One-shot data munging scripts
- Long-running codegen verified by tests or build
- Same diagnosis tried twice on Claude without progress
- Code review of a staged diff → `/codex:review`
- Pre-refactor risk scan → `/codex:adversarial-review`

### Keep on Claude (do not delegate)

- Planning, spec writing, architectural decisions
- Tasks where the brief is mushy or requirements aren't agreed
- Iteration after a draft exists
- Anything touching real credentials, secrets, or production deploys
- Anything inside an autonomous `/loop`

### Always

- Filter Codex output: "analyze each change, 95% confident before applying." Codex output is a proposal, not a commit.
- For first-draft delegations, state the agreed brief inline before invoking `/codex:rescue`, so the handoff is auditable.
- After any CSS positioning or layout change: **take a screenshot** at desktop and mobile widths before declaring done. Code review alone misses visual conflicts.
