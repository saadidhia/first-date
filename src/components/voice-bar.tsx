import { useEffect, useState } from 'react'
import { Loader2, Mic, MicOff } from 'lucide-react'

import { useVoice } from '@/lib/use-voice'
import { cn } from '@/lib/utils'

type Person = { id: number; name: string; gender: string | null }

const g = (gender: string | null | undefined, male: string, female: string) =>
  gender === 'female' ? female : male

/** The room's voice chat: everyone hears the call, one mic button to talk, and who is talking right now. */
export function VoiceBar({
  voice,
  me,
  others,
}: {
  voice: ReturnType<typeof useVoice>
  me: Person
  others: Person[]
}) {
  const left = useSecondsLeft(voice.closesAt)
  if (!voice.open) return null

  const people = new Map([me, ...others].map((p) => [p.id, p]))
  const inCall = voice.members
    .map((m) => ({ ...m, ...people.get(m.id), self: m.id === me.id }))
    .filter((m) => m.name)
  const talkers = voice.talking.map((id) => people.get(id)).filter((p): p is Person => !!p)
  const others_ = inCall.filter((m) => !m.self)

  return (
    <div className="mt-2 rounded-2xl border border-border bg-muted/40 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {inCall.length === 0 ? (
            <span className="truncate text-xs text-muted-foreground">
              🎙️ حتى حد ما يحكي. حلّ الميكرو واحكيو مع بعضكم
            </span>
          ) : (
            inCall.map((m) => {
              const speaking = voice.talking.includes(m.id)
              const linking = voice.inCall && !m.self && !voice.connected.includes(m.id)
              return (
                <span
                  key={m.id}
                  className={cn(
                    'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-all',
                    speaking
                      ? 'border-emerald-400 bg-emerald-400/15 text-emerald-200 shadow-[0_0_10px] shadow-emerald-400/50'
                      : 'border-border bg-card/70 text-foreground',
                    linking && 'opacity-60',
                  )}
                  title={linking ? 'يتّصل…' : undefined}
                >
                  {m.muted ? (
                    <MicOff className="size-3 text-muted-foreground" />
                  ) : (
                    <Mic className={cn('size-3', speaking ? 'animate-pulse text-emerald-300' : 'text-muted-foreground')} />
                  )}
                  {m.self ? 'إنتي' : m.name}
                </span>
              )
            })
          )}
        </div>

        {/* One button: red = muted, nobody hears me; green = everyone hears me */}
        <button
          type="button"
          onClick={voice.toggleMute}
          disabled={voice.joining}
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-full transition-colors',
            voice.muted ? 'bg-destructive text-white' : 'bg-emerald-500 text-white shadow-[0_0_12px] shadow-emerald-400/60',
          )}
          aria-label={voice.muted ? 'حلّ الميكرو' : 'سكّر الميكرو'}
        >
          {voice.joining ? (
            <Loader2 className="size-4 animate-spin" />
          ) : voice.muted ? (
            <MicOff className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
      </div>

      {(talkers.length > 0 || left != null || voice.error) && (
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px]">
          <span className="truncate text-emerald-300">
            {talkers.length > 0 &&
              `🔊 ${talkers.map((p) => (p.id === me.id ? 'إنتي' : p.name)).join(' و ')} ${
                talkers.length > 1
                  ? 'يحكيو'
                  : talkers[0].id === me.id
                    ? 'تحكي'
                    : g(talkers[0].gender, 'يحكي', 'تحكي')
              }…`}
          </span>
          {voice.error ? (
            <span className="text-destructive">{voice.error}</span>
          ) : (
            left != null && (
              <span className="shrink-0 tabular-nums text-gold">
                ⏳ الميكرو يتسكّر بعد {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </span>
            )
          )}
        </div>
      )}

      {voice.needsTap && voice.inCall && others_.length > 0 && (
        <p className="mt-1.5 text-[11px] font-semibold text-emerald-200">
          🔈 انزل في أي بلاصة في الشاشة باش تسمع صحابك
        </p>
      )}
      {!voice.needsTap && others_.length > 0 && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {voice.muted
            ? '🔇 الميكرو مسكّر، حد ما يسمعك. انزل عليه باش تحكي'
            : '🎙️ الميكرو محلول، صحابك يسمعوك'}
        </p>
      )}
      {!voice.muted && others_.length === 0 && (
        <p className="mt-1.5 text-[11px] text-gold">🔇 حتى حد ما يسمعك توّا. صحابك يسمعوك كي يحلّو اللعبة</p>
      )}
    </div>
  )
}

function useSecondsLeft(at: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!at) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [at])
  return at ? Math.max(0, Math.ceil((at - now) / 1000)) : null
}
