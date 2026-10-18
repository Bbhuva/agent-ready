# Phase {{N}} review ({{DATE}})

Copy this file to the phase folder as `review.md`. How to run the review is in `docs/rules/review.md`.

Reviewed by {{tool or agent, and whether it was a fresh session}}. Built by {{tool or agent}}.

## Summary

{{Two or three sentences: how healthy the code is, the most serious finding, what was cleaned up.}}

## Findings

| # | Severity | Where | What breaks, and how to trigger it | Action |
| --- | --- | --- | --- | --- |
| 1 | {{high, medium or low}} | `{{file:line}}` | {{the input or steps that make it fail}} | {{fixed in <item ID>, backlog <item ID>, or not fixed: why}} |

- **High:** data loss, a security hole, wrong money, a crash on a main path. Fix before the next phase starts.
- **Medium:** wrong behaviour on a side path.
- **Low:** works, but fragile, slow or confusing.

Checked and found nothing: {{the areas reviewed with no findings, so the next review knows what was covered}}.

## Cleanup

- Files removed: {{list, approved by the operator on <date>}}
- Code removed: {{what and where}}
- Packages removed: {{list}}
- Tests before: {{result}}. Tests after: {{result}}.

## Coverage

{{Overall coverage before and after. The floor is now N%.}}

## Retro

- **What slowed us down:**
- **What went wrong more than once:**
- **What we changed:** {{each rule or learning entry added, and its file}}
