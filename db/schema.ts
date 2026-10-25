import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

// A date room. `phase` drives the game: waiting -> question -> reveal -> ... -> done
export const rooms = pgTable('rooms', {
  id: serial().primaryKey(),
  code: text().notNull().unique(),
  mode: text().notNull().default('date'), // 'date' | 'friends'
  phase: text().notNull().default('waiting'),
  currentIndex: integer('current_index').notNull().default(0),
  phaseEndsAt: timestamp('phase_ends_at', { withTimezone: true }),
  questionIds: jsonb('question_ids').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
    token: text().notNull().unique(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('players_room_role_idx').on(t.roomId, t.role)],
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
    optionIndex: integer('option_index'), // null when the answer is free text
    text: text().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('answers_player_question_idx').on(t.playerId, t.questionIndex)],
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('events_room_idx').on(t.roomId)],
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('secret_messages_created_idx').on(t.createdAt)],
)
