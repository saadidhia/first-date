// Compact format for the question bank files.
//
// A question is [text, option, option, option]. Every question has exactly 3 options.
// An option is [text, weights], where weights is a space-separated list of trait codes
// with a score of 1 or 2, e.g. 'c2 i1'. Codes:
//   r romance · a adventure · j jealousy · i independence · h humor · t tradition · c calm
//
// Text is worded per player (see `personalize` in ../questions.ts):
//   {صاحبك} / {شريكك}  your friend / partner, becomes صاحبتك / شريكتك for a woman
//   {masc|fem}        a word about the other player, e.g. {معاه|معاها}
//   {@masc|fem}       a word about the player answering, e.g. {@متأكّد|متأكّدة}
// Questions are full questions; options are short first-person replies that read well
// on their own, since the chosen one is shown to the other player as a chat bubble.
//
// Files are append-only: a question's id is its category + position, and old rooms keep
// pointing at those ids. Add new questions at the end, never reorder or delete.
export type RawOption = [text: string, weights: string]
export type RawQuestion = [text: string, a: RawOption, b: RawOption, c: RawOption]
