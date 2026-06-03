# Event Thread Continuity Plan

## Goal

Make continuity feel like school life instead of quote recall.

The world should not only ask whether an afternoon line references a morning
line. A more natural school rhythm is:

```text
today has an event
-> different people notice it differently
-> conversations orbit the event from different angles
-> some residues remain
-> tomorrow can still feel the event
```

## v0.1 MVP

Use one bounded `campusEventThread` at a time.

The thread comes from the current school scene and calendar rhythm:

- classroom: exam, homework, cheating, awkward public answers
- cafeteria: lunch, empty seat, eating while working
- courtyard: confession, overheard secret, someone eating alone
- dormitory: late light, missed goodnight, someone crying quietly
- principal office: help request, quiet apology, formal pressure
- weekend: free activity, lunch plans, rest, unfinished homework, private check-ins

## Rules

- Do not add a giant event engine yet.
- Do not force everyone to talk about the same event.
- Do not repeat the event summary verbatim.
- Let each character approach the event through their soul:
  - Umi organizes impact and protects Alan from overload.
  - Mahiru notices quiet pain and whether someone is safe enough to speak.
  - Tianze pressure-tests the rule and decides where to stop.
  - Ichinose turns false clarity and hidden kindness costs into named debt.
  - CaoCao notices order, fairness, and exclusion.
  - Liu Bei invites the lonely or excluded person back into ordinary life.

## What Counts As Good

Good:

- the same event is mentioned in multiple conversations without the same wording
- a character references the event because it matters to their relationship
- the event changes a small behavior: checking in, refusing a task, staying nearby,
  asking about weekend plans, delaying a checklist

Bad:

- everyone recites the same event line
- the event becomes a strategy memo
- the event replaces character soul
- the event creates memory spam

## Current Implementation

The runtime now seeds at most one bounded `campusEventThread` from the current
scene during autonomous school-life advancement. It writes:

- one `worldEvents` entry
- short memory lines for up to three involved characters
- prompt context that treats the thread as shared school context, not a script

This is intentionally small. The next step is evaluation: detect whether later
conversations orbit the same event with differentiated character responses.
