import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

// A date room. `phase` drives the game: waiting -> question -> reveal -> ... -> done.
// A spin question goes spin (host turns the wheel) -> spinning -> question -> reveal.
export const rooms = pgTable('rooms', {
  id: serial().primaryKey(),
  code: text().notNull().unique(),
  mode: text().notNull().default('date'), // 'date' | 'friends'
  phase: text().notNull().default('waiting'),
  currentIndex: integer('current_index').notNull().default(0),
  phaseEndsAt: timestamp('phase_ends_at', { withTimezone: true }),
  questionIds: jsonb('question_ids').$type<string[]>().notNull(),
  // Who the wheel landed on, by question index (friends rooms)
  spins: jsonb().$type<Record<string, number>>().notNull().default({}),
  // The joker the spun player can use once: a question swapped for another one
  joker: jsonb().$type<{ index: number; skipped: string }>(),
  // When the game finished: the voice chat stays open for a few minutes after it
  endedAt: timestamp('ended_at', { withTimezone: true }),
  // Where the host came from when the room was created (instagram, google, direct…), for the funnel
  source: text(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const players = pgTable(
  'players',
  {
    id: serial().primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    role: text().notNull(), // 'host' | 'guest'
    gender: text(), // 'male' | 'female'; null for players who joined before it was asked
    // Set in a Matchy (logged-in) game; null for anonymous room players
    accountId: integer('account_id').references(() => accounts.id, {
      onDelete: 'cascade',
    }),
    token: text().notNull().unique(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    // A date room has one guest, a friends room up to 6 more: the limit is checked in joinRoom
    index('players_room_idx').on(t.roomId),
    index('players_created_idx').on(t.createdAt),
    index('players_last_seen_idx').on(t.lastSeenAt),
  ],
)

export const answers = pgTable(
  'answers',
  {
    id: serial().primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    questionIndex: integer('question_index').notNull(),
    optionIndex: integer('option_index'), // null when the answer is free text or a vote
    // The player voted for, on vote questions
    voteFor: integer('vote_for').references(() => players.id, {
      onDelete: 'cascade',
    }),
    text: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex('answers_player_question_idx').on(t.playerId, t.questionIndex),
  ],
)

// Room events such as screenshot attempts, shown to the other player
export const events = pgTable(
  'events',
  {
    id: serial().primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    playerId: integer('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    type: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('events_room_idx').on(t.roomId)],
)

// Who is in the room's voice chat. A row counts while seen_at is recent; `speaking` lets the
// players who didn't join see who is talking
export const voiceMembers = pgTable(
  'voice_members',
  {
    playerId: integer('player_id')
      .primaryKey()
      .references(() => players.id, { onDelete: 'cascade' }),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    muted: boolean().notNull().default(false),
    speaking: boolean().notNull().default(false),
    seenAt: timestamp('seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('voice_members_room_idx').on(t.roomId)],
)

export type VoiceSignal = {
  // hello: "I opened the page again, send me a new offer"
  type: 'offer' | 'answer' | 'ice' | 'hello'
  sid: string
  sdp?: string
  candidate?: {
    candidate?: string
    sdpMid?: string | null
    sdpMLineIndex?: number | null
    usernameFragment?: string | null
  }
}

// WebRTC setup messages (offer, answer, ICE candidates) passed between two players of a room.
// The audio itself goes straight between the players; rows are deleted after a couple of minutes.
export const voiceSignals = pgTable(
  'voice_signals',
  {
    id: serial().primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    fromId: integer('from_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    toId: integer('to_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    data: jsonb().$type<VoiceSignal>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('voice_signals_to_idx').on(t.toId, t.id),
    index('voice_signals_room_idx').on(t.roomId),
  ],
)

// Messages sent through the public /sir link to the admins. The sender gives their Instagram
// username, and the form tells them the admin sees it.
export const secretMessages = pgTable(
  'secret_messages',
  {
    id: serial().primaryKey(),
    instagram: text(),
    // App the message was sent from, guessed from the user agent (e.g. Instagram's in-app browser)
    source: text(),
    body: text().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('secret_messages_created_idx').on(t.createdAt)],
)

// One row per minute in which at least one player's room polled, so the admin can see
// whether the site ever had nobody on it
export const activityMinutes = pgTable('activity_minutes', {
  minute: timestamp({ withTimezone: true }).primaryKey(),
})

// ---------------------------------------------------------------------------
// Matchy: logged-in players, a coin wallet, paid match games, friends and chat.
// ---------------------------------------------------------------------------

// A logged-in account. Signup asks for a name, birthday and password; the username is
// generated for them. 1000 coins = 1000 millimes. A new account starts with 3000 coins.
export const accounts = pgTable(
  'accounts',
  {
    id: serial().primaryKey(),
    username: text().notNull().unique(),
    name: text().notNull(),
    birthday: text().notNull(), // 'YYYY-MM-DD'
    gender: text(), // 'male' | 'female'; optional, personalizes the game
    passwordHash: text('password_hash').notNull(),
    passwordSalt: text('password_salt').notNull(),
    coins: integer().notNull().default(3000),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('accounts_last_seen_idx').on(t.lastSeenAt)],
)

// An invitation to a match game. The starter creates the room and invites a free player;
// the other accepts to join and the game begins.
export const matchInvites = pgTable(
  'match_invites',
  {
    id: serial().primaryKey(),
    roomId: integer('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    fromId: integer('from_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toId: integer('to_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    status: text().notNull().default('pending'), // pending | accepted | declined | cancelled
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('match_invites_to_idx').on(t.toId, t.status),
    index('match_invites_from_idx').on(t.fromId, t.status),
  ],
)

// The result of a finished match game and the coins charged to the starter. One row per
// room (unique) so the charge happens exactly once.
export const matches = pgTable('matches', {
  id: serial().primaryKey(),
  roomId: integer('room_id')
    .notNull()
    .unique()
    .references(() => rooms.id, { onDelete: 'cascade' }),
  starterId: integer('starter_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  otherId: integer('other_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  scorePct: integer('score_pct').notNull(),
  matched: boolean().notNull(),
  coinsCharged: integer('coins_charged').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Two rows per friendship (a->b and b->a) so each side lists its friends with one query.
// Created when two accounts match (>= 50%).
export const friendships = pgTable(
  'friendships',
  {
    id: serial().primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    friendId: integer('friend_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex('friendship_pair_idx').on(t.accountId, t.friendId)],
)

// Direct messages between two matched accounts (friends). A conversation is the messages
// where {from,to} is that pair, either direction.
export const chatMessages = pgTable(
  'chat_messages',
  {
    id: serial().primaryKey(),
    fromId: integer('from_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    toId: integer('to_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('chat_messages_from_to_idx').on(t.fromId, t.toId, t.id),
    index('chat_messages_to_idx').on(t.toId, t.id),
  ],
)

// Prepaid coin codes the admin generates and sells; a player redeems one to top up.
export const coinVouchers = pgTable(
  'coin_vouchers',
  {
    id: serial().primaryKey(),
    code: text().notNull().unique(),
    coins: integer().notNull(),
    // Who redeemed it and when; null while it's still unused
    redeemedBy: integer('redeemed_by').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
    // Optional batch note (e.g. "instagram sept")
    note: text(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('coin_vouchers_redeemed_idx').on(t.redeemedBy)],
)

// A coin purchase through a payment provider (Flouci). One row per attempt; coins are
// credited once when the provider confirms the payment (status -> 'paid').
export const payments = pgTable(
  'payments',
  {
    id: serial().primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    provider: text().notNull().default('flouci'),
    // Our own id, placed in the return link so the callback knows which payment
    trackingId: text('tracking_id').notNull().unique(),
    // The provider's payment id (Flouci payment_id), set after it's created
    providerRef: text('provider_ref'),
    packId: text('pack_id').notNull(),
    coins: integer().notNull(),
    amountMillimes: integer('amount_millimes').notNull(),
    status: text().notNull().default('pending'), // pending | paid | failed
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('payments_account_idx').on(t.accountId, t.id),
    index('payments_provider_ref_idx').on(t.providerRef),
  ],
)

// Coin ledger: one row per balance change (negative = charge, positive = credit).
export const walletTx = pgTable(
  'wallet_tx',
  {
    id: serial().primaryKey(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    amount: integer().notNull(),
    reason: text().notNull(), // 'signup_bonus' | 'match'
    roomId: integer('room_id').references(() => rooms.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index('wallet_tx_account_idx').on(t.accountId, t.id)],
)
