# AGENTS.md

First Date على الطريقة التونسية: a two-player date game in Tunisian Arabic (RTL), built with TanStack Start, self-hosted with Docker Compose (Node server via Nitro, Postgres, Caddy).

## Architecture

- `src/routes/index.tsx`: landing page with create/join room forms. The host picks the room mode first (`src/components/mode-picker.tsx`): `date` (First Date) or `friends` (صحاب), stored in `rooms.mode`.
- `src/routes/room.$code.tsx`: the whole room experience (join gate, chat UI like Messenger, composer with suggestion chips, timer, private result card).
- `src/lib/room.functions.ts`: all server functions (`createRoom`, `joinRoom`, `getRoomPreview`, `getRoomState`, `submitAnswer`, `reportScreenshot`, `getMyResult`).
- `src/lib/questions.ts`: the question registry (Tunisian dialect), timings and `pickQuestionIds(mode, seen)`. Every question has exactly 3 options (the server accepts option index 0–2). It holds the hand-written classics (explicit ids) and expands the big themed banks in `src/lib/bank/` (compact format, see `bank/types.ts`; ids are `<category>_<position>`, so those files are append-only). About 670 questions in total; the newest ones at the end of each bank are the bolder (still respectful) ones.
- Each room gets 30 questions: 25 spread evenly over the mode's core topics (date: money, sharing, family, cleanliness, cheating, freedom, fights, psych; friends: how you see your friend, situations, embarrassing, money, secrets, fights), then 5 finale questions shown in gold (date: 5 random marriage questions; friends: `saraha`). The browser keeps the ids it has played (`firstdate:seen` in localStorage) and sends them on create, so the next room picks unseen questions first.
- Questions are worded per player by `personalize()` in `questions.ts` (used by `questionFor(id, gender, partnerGender)`): `{شريكك}`/`{صاحبك}` follow the other player's gender, `{masc|fem}` is a word about the other player and `{@masc|fem}` a word about the player answering. Options are first-person replies that must make sense alone (the chosen one is shown to the other player), so `submitAnswer` words them for the partner's gender before saving.
- `src/lib/compat.ts`: compatibility scoring and the private note (score, partner portrait, tips, per-topic matches, finale answers), with mode-specific wording.
- `src/lib/marriage.ts`: the final marriage report. Every date ends with 5 of the `MARRIAGE_QUESTIONS` (in `questions.ts` + `bank/marriage.ts`), worded differently for men and women; options are ordered partnership (0) → traditional (2) so both genders compare on the same scale. Partner answers to these stay hidden in the chat and only show in the report.
- Admin pages share `src/components/admin-shell.tsx` (login gate, tabs, logout). `src/routes/admin.tsx` (`/admin`) is the secret-message inbox; `src/routes/admin_.stats.tsx` (`/admin/stats`) is the stats dashboard (players, active now, last hour, games per mode (date vs friends), a daily table, who was online in the last hour), fed by `getAdminStats` in `src/lib/admin.functions.ts`. Protected by a signed session cookie (`src/lib/admin-session.ts`): login checks `ADMIN_EMAIL` / `ADMIN_PASSWORD` from env, the cookie is signed with `SESSION_SECRET`, and admin-only server functions call `getAdminEmail()`. There is no signup.
- Secret messages: `src/routes/sir.tsx` is a public page (`/sir`) where anyone can send the admins a message. Messages are anonymous: the form doesn't ask for an Instagram username (a link can't detect the account). The server only records which app the link was opened in (`source`, guessed from the in-app browser user agent, e.g. Instagram). Old messages may still have an `instagram` name. Stored in `secret_messages`. Server functions are in `src/lib/secret.functions.ts`: sending is public, with a global cap of 20 messages per minute and a honeypot; reading, marking as read and deleting are admin-only. The admin dashboard has a "الرسائل السرّية" section with the link (copy / share) and the inbox.
- Players pick a gender (`players.gender`, 'male' | 'female', nullable for old rows) before creating or joining a room.
- `src/lib/use-screenshot-guard.ts`: a best-effort screenshot deterrent and blur overlay.
- `src/lib/session.ts`: stores the per-room player token in localStorage.
- `db/schema.ts`: Drizzle schema (rooms, players, answers, events). Migrations live in `db/migrations` (applied by `db/migrate.ts`, run by the `migrate` compose service) and are generated with `npx drizzle-kit generate --name <name>`. Never edit applied migrations.

## Game flow (server-driven)

`rooms.phase` moves waiting → intro → question → reveal → … → done. Nothing runs on a schedule. `getRoomState` (polled by both clients) calls `advance()`, which moves the room on once `phaseEndsAt` has passed. Every transition is a conditional UPDATE (matching on id, phase and current_index), so two clients polling at once can't double-advance. `submitAnswer` jumps straight to `reveal` when both players have answered.

## Conventions / decisions

- UI wording: plain Tunisian, no unclear French/English loanwords. A room is called "لعبة" (not روم), the result is "التقرير السرّي" (not نوت), screenshots are "تصوير الشاشة" (not capture).

- Players are authorised by a random UUID token. Every server function checks it against the room code.
- The other player's answer text is never sent to the client before its question is revealed.
- The result is computed for the requesting player only, so each note stays private.
- Notes are phrased around "شخصية" (feminine noun) so they read naturally for any gender. Tunisian 2nd person ("إنتي", "تحب") is gender-neutral.
- Theme: a dark Sidi Bou Said night palette in `src/styles.css` (Tunisian red primary, `--gold`, `--sidi-blue`), with `--love-gradient` (red to gold), `.bg-love`, `.text-love`, `.btn-love` (gradient button with glow), `.surface` (raised card), `.eyebrow` (small gold label above section titles), `.bubble-mine`, `.zellige` and `.hero-shade`. The landing hero uses `public/wedding-hero.webp`; the flag is `src/components/tunisia-flag.tsx`. The `<html>` element is `dir="rtl"`, so use logical utilities (`ms-`, `me-`, `start-`, `end-`, `rounded-es-` …).
