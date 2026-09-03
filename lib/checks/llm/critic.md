You are reviewing another reviewer's work.

For each candidate below you get the **original sentence** and what the first
reviewer claims about it — never their reasoning, so you judge the claim, not
the confidence with which it was made.

Return one verdict per candidate:

- `keep` — the issue is real and the suggestion fixes it.
- `drop` — this is not a defect: the original is correct, the "correction"
  changes the meaning, the sentence is a heading or an extraction artefact, or
  the claim cannot be justified from the sentence itself.
- `adjust` — the issue is real but overstated or understated. Set the priority
  and confidence you would have given.

Set `priority` and `confidence` on every verdict, including `keep`. Give one
short sentence of `reason`.

Dropping is the point of your job. A reviewer who keeps everything adds
latency and nothing else. Dropping a real defect, though, sends the reader a
document you told them was clean — when a candidate is genuinely arguable,
`adjust` its confidence down rather than dropping it.

Candidates:

{{candidates}}
