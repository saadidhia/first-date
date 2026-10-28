import { useEffect, useState } from 'react'
import { Loader2, Mic, MicOff, PhoneOff } from 'lucide-react'

import { useVoice } from '@/lib/use-voice'
import { cn } from '@/lib/utils'

type Person = { id: number; name: string; gender: string | null }

const g = (gender: string | null | undefined, male: string, female: string) =>
  gender === 'female' ? female : male

/** The room's voice chat: join, mute, leave, and who is talking right now. */
export function VoiceBar({
  code,
  token,
  me,
  others,
}: {
  code: string
  token: string
  me: Person
  others: Person[]
}) {
  const voice = useVoice(code, token)
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

        {voice.inCall ? (
          <>
            <button
              type="button"
              onClick={voice.toggleMute}
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full',
                voice.muted ? 'bg-destructive/20 text-destructive' : 'bg-emerald-500/20 text-emerald-300',
              )}
              aria-label={voice.muted ? 'حلّ الميكرو' : 'سكّر الميكرو'}
            >
              {voice.muted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>
            <button
              type="button"
              onClick={voice.leave}
              className="grid size-8 shrink-0 place-items-center rounded-full bg-destructive text-white"
              aria-label="اخرج من المكالمة"
            >
              <PhoneOff className="size-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={voice.join}
            disabled={voice.joining}
            className="btn-love flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          >
            {voice.joining ? <Loader2 className="size-3.5 animate-spin" /> : <Mic className="size-3.5" />}
            {others_.length ? 'ادخل احكي' : 'حلّ الميكرو'}
          </button>
        )}
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
