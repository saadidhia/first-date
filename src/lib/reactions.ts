// The emoji players can put on a revealed question (shared by the server check and the UI)
export const REACTIONS = ['😂', '😳', '❤️', '🔥'] as const
export type Reaction = (typeof REACTIONS)[number]
