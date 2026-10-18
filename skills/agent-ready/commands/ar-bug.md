---
description: Report something broken. The agent finds the cause, fixes it with a test, and explains.
argument-hint: "[what happened]"
---
The operator is reporting a problem: $ARGUMENTS

Follow `docs/rules/bugs.md`. Get a clear report (ask only for what is missing, in one message), log it as a `bug-` item, make it happen yourself, write a failing test, name the cause, then fix it with the smallest change, review it and save it.

If it is hurting real users right now, say so first, and whether going back to an earlier save point (`/ar-undo`) would stop it while you fix it. When it is fixed, tell them what was wrong and what changed, in plain words.
