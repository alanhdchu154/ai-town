# GIIS Underworld Soul Architecture

## v0.1 North Star

GIIS Underworld v0.1 is a persistent emotional social simulation where
characters slowly change through time, memory, relationships, and shared
atmosphere.

The goal is not:

> AI agents talking.

The goal is:

> A world where yesterday emotionally matters.

GIIS Underworld is an experimental emotional social simulation built on top of
the AI Town foundation. The goal is not simply to make agents move and talk. The
goal is to let characters accumulate memory, emotional residue, relationship
drift, and behavioral change over time.

The core design question is:

> Can characters remember, care, change, and leave emotional traces over time?

This document defines the Soul Five-Layer model used for pilot characters,
prompt design, eval design, and future memory/behavior work.

## Why This Exists

AI Town demonstrates autonomous agents in a shared world.

GIIS Underworld is becoming a long-term social world where Alan can return
tomorrow and feel that yesterday mattered. Conversation is only one layer of the
world. Silence, availability, initiative, movement, daily state, and memory
residue matter too.

The project should not grow by adding more lore too early. It should first make
the existing world more human.

## Soul Five-Layer Model

### 1. Public Self

Public Self is how the character behaves outwardly.

It includes:

- role
- tone
- social habits
- visible strengths
- default way of helping
- what other characters expect from them

Public Self should be easy for a player to recognize. It is the surface pattern:
how the character enters a room, responds to pressure, and speaks when nothing
deep has happened yet.

### 2. Private Self

Private Self is what the character worries about, hides, or cannot easily admit.

It includes:

- hidden fear
- emotional vulnerability
- unmet desire
- shame or insecurity
- private cost of their public role

Private Self should not be dumped directly into dialogue. It should leak through
small choices: hesitation, deflection, shorter replies, humor, silence, or
over-functioning.

### 3. Relational Self

Relational Self is how the character changes depending on who they are facing.

A character should not care for everyone the same way.

Examples:

- Umi may organize Alan's overload, but deflect care when Mahiru notices her.
- Mahiru may gently check Umi, but become quieter around someone who refuses
  care.
- Tianze may turn Alan's vision into a pressure test, but with Umi she may
  notice when testing starts becoming harm.

Relational Self is the main tool for preventing emotional sameness. If two
characters share the same concern, they still need different care languages.

### 4. Emotional Residue

Emotional Residue is what remains after events and conversations.

It is not a full transcript. It is the emotional trace that survives.

Good residue:

- "Mahiru noticed I was still awake before I did."
- "Umi sounded useful, but not rested."
- "They said the rule was safe. Tianze heard who would be hurt first."

Bad residue:

- a log dump
- a summary of every line
- a generic mood label
- fallback/template text saved as memory

Residue should be small, selective, and emotionally loaded.

### 5. Behavioral Drift

Behavioral Drift is how emotion and memory gradually change action, silence,
availability, and initiative.

This is the layer that makes the world feel alive.

Examples:

- If Alan repeatedly ignores rest, Umi becomes more direct.
- If Mahiru keeps checking on Umi, Umi becomes quieter and more honest.
- If Tianze pushes too close to a wound, her replies become shorter and she
  stops before the second question.
- If a character is hurt, they may avoid a large meeting and seek a one-on-one
  conversation instead.

Behavioral Drift should be subtle. Characters should not swap identities.

## Optional Long-Term Layer: Long-Term Arc

Long-Term Arc describes how a character may slowly evolve across many days.

This is not a sudden rewrite of personality. It is a slow direction of growth.

Core rule:

> Do not overwrite personality. Characters should grow like trees, not swap
> identities.

A character can learn, soften, become more direct, or develop new trust, but
their roots should remain recognizable.

## Soul Differentiation Rule

GIIS Underworld should not only produce emotional dialogue. It should produce
distinct emotional existence.

Each character should:

- care differently
- worry differently
- avoid differently
- comfort differently
- carry burden differently
- become tired differently

If two characters emotionally align, they must still express it differently.

Bad:

- same metaphor
- same emotional phrase
- same rhythm
- same comfort style

Good:

- same emotional direction
- different emotional language

Umi protects by reducing overload.

Mahiru protects by staying near and noticing quiet pain.

Tianze protects by testing whether a rule has a real bottom, then slowly
learning to stop before the test becomes cruelty.

## Behavioral Consequence Rule

Emotion should affect behavior, not only speech.

Prefer small human behavior:

- putting down a pen
- not answering immediately
- changing topic
- staying nearby
- asking if someone ate
- delaying a task
- shortening a briefing
- leaving a large room for a one-on-one moment

Avoid turning every emotional moment into world analysis.

## Golden Moments

Golden moments are examples of the world feeling alive. They are not mandatory
scripts, but quality references for prompt and eval work.

Examples:

- 天澤：「不是所有事都該默默丟給我。」
- 曹操 using order to protect people who hesitate at the door.
- 真晝 noticing Umi is tired before Umi admits it.
- Umi shortening a briefing because she realizes Alan is overloaded.

These moments matter because they reveal how a character loves, protects, or
worries in a way that only they would.

## Current v0.1 Pilot And Secondary Profiles

The current soul pilot focuses on:

- Umi / 海
- Mahiru / 真晝
- Tianze / 天澤

The goal is not to expand v0.1 acceptance to every character immediately. The
goal is to prove that a small group can carry differentiated emotional
continuity before the system scales.

Because secondary characters may now participate through local LLM paths, they
also need soul definitions. These definitions protect character identity and
prevent thin local-LLM dialogue, but they should not become a reason to build
large all-character systems yet.

Secondary soul profiles:

- CaoCao / 曹操: order as protection
- Ichinose / 一之瀨: angelic warmth that turns kindness into named debt
- Liu Bei / 劉備: invitation as protection

v0.1 success:

> Alan returns tomorrow and feels: yesterday mattered, and Umi, Mahiru, and
> Tianze are not exactly the same.

## What Not To Do Yet

Do not:

- add giant new soul systems
- rewrite every character
- force poetic dialogue
- increase verbosity as a substitute for depth
- archive fallback/template text as memory
- make the world bigger before the current world feels human

This is an early prototype. It is not AGI, not production-ready, and not a claim
that characters are conscious. It is an experiment in emotional continuity,
social memory, and long-term character simulation.
