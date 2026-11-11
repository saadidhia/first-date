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

// Solo "play with the AI" mode (see ../ai.ts). A question is [text, option, option, option];
// an option is [text, code] where the code says how balanced that answer is on the
// question's dimension: '2' balanced, 'a1'/'a0' leaning to the dimension's first pole
// (0 = strongly), 'b1'/'b0' leaning to its second pole. Text uses {@masc|fem} for the
// player. Ids are `ai_<dimension>_<position>`: append-only like the other banks.
export type AiRawOption = [text: string, code: '2' | 'a1' | 'a0' | 'b1' | 'b0']
export type AiRawQuestion = [text: string, a: AiRawOption, b: AiRawOption, c: AiRawOption]
