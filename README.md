# First Date 💘

A two-player "first date" game in Tunisian Arabic. One person creates a room and gets a 6-character code. They send it to the other person, and the two answer 15 timed questions together in a chat screen styled like Messenger. The questions are bold, fun, and psychological. At the end, each player privately sees a compatibility note about the other, and neither sees what the other was told.

## Features

- **Rooms by code**: create a room, share the code or link (WhatsApp/native share), and the second person joins. A room holds two people only.
- **Chat UI like Messenger**: written right to left, with gradient bubbles, a typing indicator, an online status, and a countdown ring for each question.
- **45-second timer** on each question, plus one-tap suggested answers (or a free-text reply).
- **Answers revealed together**: you only see the other person's answer after you've both answered (or time runs out).
- **Private result**: a compatibility score, the partner's top personality traits, answers you matched on, answers you differed on, and warnings.
- **Screenshot guard**: catches PrintScreen, Win+Shift+S, Cmd+Shift+3/4/5 and print, and blurs the room whenever the tab loses focus. The other player gets an instant alert. (No browser can fully block OS-level screenshots, especially on phones, so this guard deters screenshots rather than preventing them.)

## Tech

- TanStack Start (React 19) + Tailwind CSS 4, deployed on Netlify
- Netlify Database (Postgres) via Drizzle ORM, for rooms, players, answers and screenshot events
- TanStack Start server functions for the backend. Updates arrive by polling about every 1.2 s.

## Run locally

```bash
pnpm install
netlify dev
```

## Editing questions

All questions live in `src/lib/questions.ts`. Each option has trait weights that feed the compatibility scoring in `src/lib/compat.ts`.
