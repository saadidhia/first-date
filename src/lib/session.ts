// The per-room player token lives in localStorage so a refresh keeps you in the room.
const key = (code: string) => `firstdate:token:${code.toUpperCase()}`

export function getToken(code: string): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(key(code))
}

export function saveToken(code: string, token: string) {
  window.localStorage.setItem(key(code), token)
}

export function getSavedName(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('firstdate:name') ?? ''
}

export function saveName(name: string) {
  window.localStorage.setItem('firstdate:name', name)
}

export type Gender = 'male' | 'female'

export function getSavedGender(): Gender | null {
  if (typeof window === 'undefined') return null
  const g = window.localStorage.getItem('firstdate:gender')
  return g === 'male' || g === 'female' ? g : null
}

export function saveGender(gender: Gender) {
  window.localStorage.setItem('firstdate:gender', gender)
}

// Question ids from the rooms this browser already played, so the next room brings new ones
const SEEN_KEY = 'firstdate:seen'
const SEEN_MAX = 800

export function getSeenQuestions(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const list = JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function addSeenQuestions(ids: string[]) {
  const merged = [...new Set([...ids, ...getSeenQuestions()])].slice(0, SEEN_MAX)
  window.localStorage.setItem(SEEN_KEY, JSON.stringify(merged))
}
