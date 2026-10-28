import { useCallback, useEffect, useRef, useState } from 'react'

import type { VoiceSignal } from '../../db/schema'
import { voiceSync } from './voice.functions'

// The room's voice chat: every player in the call is connected to every other one (WebRTC,
// audio only), and the server just relays the setup messages through `voiceSync`.
// To avoid both sides offering at once, the player with the smaller id always makes the offer.

type Member = { id: number; muted: boolean; speaking: boolean }
type Signal = VoiceSignal
type Peer = {
  pc: RTCPeerConnection
  sid: string
  audio: HTMLAudioElement
  pending: RTCIceCandidateInit[]
  startedAt: number
  level?: AnalyserNode
}

const SYNC_IN_CALL_MS = 800
const SYNC_IDLE_MS = 2500
// A connection that isn't up after this long is dropped and tried again
const CONNECT_MS = 15_000
const SPEAK_LEVEL = 0.025
const SPEAK_HOLD_MS = 450

// In-app browsers (Instagram, Facebook, TikTok, Snapchat) often refuse the mic
const IN_APP = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat/i
const OPEN_IN_BROWSER = 'الميكرو ما يخدمش هوني. حلّ اللعبة في Chrome ولا Safari باش تحكي 🎙️'

function micError(e: unknown) {
  const name = e instanceof DOMException ? e.name : ''
  const inApp = IN_APP.test(navigator.userAgent)
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return inApp ? OPEN_IN_BROWSER : 'لازم تعطي الإذن للميكرو باش تحكي 🎙️'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'ما لقيناش ميكرو في الجهاز هذا'
  if (name === 'NotReadableError') return 'الميكرو خدّام في تطبيق آخر، سكّرو وعاود جرّب'
  return inApp ? OPEN_IN_BROWSER : 'ما نجّمناش نحلّو الميكرو'
}

export function useVoice(code: string, token: string) {
  const [open, setOpen] = useState(true)
  const [closesAt, setClosesAt] = useState<number | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inCall, setInCall] = useState(false)
  const [joining, setJoining] = useState(false)
  const [muted, setMuted] = useState(false)
  const [talking, setTalking] = useState<number[]>([])
  const [connected, setConnected] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const me = useRef(0)
  const inCallRef = useRef(false)
  const mutedRef = useRef(false)
  const speakingRef = useRef(false)
  const since = useRef(0)
  const outbox = useRef<{ to: number; data: Signal }[]>([])
  const peers = useRef(new Map<number, Peer>())
  const stream = useRef<MediaStream | null>(null)
  const ctx = useRef<AudioContext | null>(null)
  const myLevel = useRef<AnalyserNode | null>(null)
  const ice = useRef<RTCIceServer[]>([])
  const serverSpeaking = useRef(new Set<number>())
  const kick = useRef<(soon?: boolean) => void>(() => {})

  const refreshConnected = useCallback(() => {
    const ids = [...peers.current]
      .filter(([, p]) => p.pc.connectionState === 'connected')
      .map(([id]) => id)
      .sort((a, b) => a - b)
    setConnected((old) => (old.join() === ids.join() ? old : ids))
  }, [])

  // A browser can refuse to start the sound without a tap (mostly iPhones): it starts on the next one
  const playOnTap = useCallback(() => {
    const play = () => {
      ctx.current?.resume().catch(() => {})
      for (const p of peers.current.values()) p.audio.play().catch(() => {})
    }
    document.addEventListener('pointerdown', play, { once: true })
  }, [])

  const send = useCallback((to: number, data: Signal) => {
    outbox.current.push({ to, data })
    kick.current(true)
  }, [])

  const closePeer = useCallback(
    (id: number) => {
      const p = peers.current.get(id)
      if (!p) return
      peers.current.delete(id)
      p.pc.close()
      p.audio.srcObject = null
      p.audio.remove()
      refreshConnected()
    },
    [refreshConnected],
  )

  const makePeer = useCallback(
    (id: number, sid: string) => {
      const pc = new RTCPeerConnection({ iceServers: ice.current })
      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', '')
      audio.hidden = true
      document.body.appendChild(audio)
      const peer: Peer = { pc, sid, audio, pending: [], startedAt: Date.now() }
      pc.onicecandidate = (e) => {
        if (e.candidate) send(id, { type: 'ice', sid, candidate: e.candidate.toJSON() })
      }
      pc.ontrack = (e) => {
        const remote = e.streams[0] ?? new MediaStream([e.track])
        audio.srcObject = remote
        audio.play().catch(playOnTap)
        // Only for showing who talks: the sound itself goes through the audio element
        if (ctx.current) {
          try {
            const level = ctx.current.createAnalyser()
            level.fftSize = 512
            ctx.current.createMediaStreamSource(remote).connect(level)
            peer.level = level
          } catch {
            // Then their talking is read from the server instead
          }
        }
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' && peers.current.get(id) === peer) closePeer(id)
        refreshConnected()
      }
      peers.current.set(id, peer)
      return peer
    },
    [send, closePeer, refreshConnected, playOnTap],
  )

  const call = useCallback(
    async (id: number) => {
      const peer = makePeer(id, crypto.randomUUID())
      for (const track of stream.current?.getTracks() ?? []) peer.pc.addTrack(track, stream.current!)
      await peer.pc.setLocalDescription(await peer.pc.createOffer())
      send(id, { type: 'offer', sid: peer.sid, sdp: peer.pc.localDescription!.sdp })
    },
    [makePeer, send],
  )

  const onSignal = useCallback(
    async (from: number, s: Signal) => {
      if (s.type === 'offer' && s.sdp) {
        // A new offer always starts a fresh connection
        closePeer(from)
        const peer = makePeer(from, s.sid)
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp })
        // Added after the offer so the track goes in the transceiver the offer created
        for (const track of stream.current?.getTracks() ?? []) peer.pc.addTrack(track, stream.current!)
        await peer.pc.setLocalDescription(await peer.pc.createAnswer())
        send(from, { type: 'answer', sid: s.sid, sdp: peer.pc.localDescription!.sdp })
        for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {})
        return
      }
      const peer = peers.current.get(from)
      if (!peer || peer.sid !== s.sid) return
      if (s.type === 'answer') {
        if (peer.pc.signalingState !== 'have-local-offer' || !s.sdp) return
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp })
        for (const c of peer.pending.splice(0)) await peer.pc.addIceCandidate(c).catch(() => {})
      } else if (s.candidate) {
        if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(s.candidate).catch(() => {})
        else peer.pending.push(s.candidate)
      }
    },
    [closePeer, makePeer, send],
  )

  const hangUp = useCallback(() => {
    inCallRef.current = false
    speakingRef.current = false
    for (const id of [...peers.current.keys()]) closePeer(id)
    for (const t of stream.current?.getTracks() ?? []) t.stop()
    stream.current = null
    myLevel.current = null
    ctx.current?.close().catch(() => {})
    ctx.current = null
    outbox.current = []
    setInCall(false)
    setTalking([])
  }, [closePeer])

  // The sync loop: fast while in the call, slow otherwise (to show who is in it), and it stops
  // once the voice chat has closed for good
  useEffect(() => {
    let stop = false
    let busy = false
    let again = false
    let resend = true
    let timer: number | undefined

    const tick = async () => {
      window.clearTimeout(timer)
      if (busy) {
        again = true
        return
      }
      busy = true
      let closed = false
      const out = outbox.current.splice(0, 60)
      try {
        const res = await voiceSync({
          data: {
            code,
            token,
            inCall: inCallRef.current,
            muted: mutedRef.current,
            speaking: speakingRef.current,
            since: since.current,
            out,
          },
        })
        if (stop) return
        me.current = res.me
        if (res.iceServers.length) ice.current = res.iceServers
        const offset = new Date(res.serverNow).getTime() - Date.now()
        setClosesAt(res.closesAt ? new Date(res.closesAt).getTime() - offset : null)
        if (!res.open) {
          closed = true
          setOpen(false)
          if (inCallRef.current) hangUp()
        }
        for (const s of res.signals) {
          since.current = s.id
          if (inCallRef.current) await onSignal(s.from, s.data).catch(() => {})
        }
        const others = res.members.filter((m) => m.id !== res.me)
        serverSpeaking.current = new Set(others.filter((m) => m.speaking).map((m) => m.id))
        setMembers((old) => (JSON.stringify(old) === JSON.stringify(res.members) ? old : res.members))
        if (inCallRef.current) {
          const ids = new Set(others.map((m) => m.id))
          for (const [id, p] of peers.current) {
            const stuck = p.pc.connectionState !== 'connected' && Date.now() - p.startedAt > CONNECT_MS
            if (!ids.has(id) || (stuck && res.me < id)) closePeer(id)
          }
          for (const id of ids) if (res.me < id && !peers.current.has(id)) await call(id)
        }
        resend = true
        setError(null)
      } catch {
        // A missed sync is retried on the next tick, with the messages it didn't get to send
        // (once: a message the server refuses must not block the ones after it)
        if (inCallRef.current && resend) outbox.current.unshift(...out)
        resend = false
      } finally {
        busy = false
        if (!stop && !closed) {
          const delay = again || outbox.current.length ? 100 : inCallRef.current ? SYNC_IN_CALL_MS : SYNC_IDLE_MS
          again = false
          if (inCallRef.current || !document.hidden) timer = window.setTimeout(tick, delay)
        }
      }
    }

    kick.current = (soon) => {
      if (stop) return
      window.clearTimeout(timer)
      timer = window.setTimeout(tick, soon ? 100 : 0)
    }
    const onVisible = () => !document.hidden && kick.current()
    tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stop = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      hangUp()
    }
  }, [code, token, onSignal, call, closePeer, hangUp])

  // Who is talking: measured on the audio itself for me and the players I'm connected to,
  // and taken from the server for the others
  useEffect(() => {
    const buf = new Float32Array(512)
    const lastLoud = new Map<number, number>()
    const loud = (a: AnalyserNode | null | undefined) => {
      if (!a) return false
      a.getFloatTimeDomainData(buf)
      let sum = 0
      for (const v of buf) sum += v * v
      return Math.sqrt(sum / buf.length) > SPEAK_LEVEL
    }
    const id = window.setInterval(() => {
      const now = Date.now()
      const ids: number[] = []
      if (inCallRef.current) {
        if (!mutedRef.current && loud(myLevel.current)) lastLoud.set(me.current, now)
        for (const [pid, p] of peers.current) if (loud(p.level)) lastLoud.set(pid, now)
        for (const [pid, t] of lastLoud) if (now - t < SPEAK_HOLD_MS) ids.push(pid)
        speakingRef.current = ids.includes(me.current) && !mutedRef.current
      }
      for (const pid of serverSpeaking.current)
        if (!peers.current.get(pid)?.level && !ids.includes(pid)) ids.push(pid)
      ids.sort((a, b) => a - b)
      setTalking((old) => (old.join() === ids.join() ? old : ids))
    }, 120)
    return () => window.clearInterval(id)
  }, [])

  // The chat closes by itself 5 minutes after the game
  useEffect(() => {
    if (!closesAt) return
    const id = window.setTimeout(() => kick.current(), Math.max(0, closesAt - Date.now()) + 500)
    return () => window.clearTimeout(id)
  }, [closesAt])

  const join = useCallback(async () => {
    if (inCallRef.current || joining) return
    if (!window.isSecureContext) {
      setError('الميكرو يخدم كان كي تحلّ اللعبة بـ https://')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setError(
        IN_APP.test(navigator.userAgent)
          ? OPEN_IN_BROWSER
          : 'المتصفّح هذا ما يخلّيكش تحكي. حلّ اللعبة في Chrome ولا Safari.',
      )
      return
    }
    setJoining(true)
    setError(null)
    // Made during the tap itself: iPhones only let sound start from one. It only measures who
    // is talking, so the call works without it.
    let ac: AudioContext | null = null
    try {
      const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      ac = AC ? new AC() : null
      ac?.resume().catch(() => {})
    } catch {
      // No sound meter on this browser
    }
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      stream.current = mic
      if (ac) {
        try {
          const level = ac.createAnalyser()
          level.fftSize = 512
          ac.createMediaStreamSource(mic).connect(level)
          myLevel.current = level
          ctx.current = ac
        } catch {
          ac.close().catch(() => {})
        }
      }
      mutedRef.current = false
      setMuted(false)
      inCallRef.current = true
      setInCall(true)
      kick.current()
    } catch (e) {
      ac?.close().catch(() => {})
      setError(micError(e))
    } finally {
      setJoining(false)
    }
  }, [joining])

  const leave = useCallback(() => {
    hangUp()
    kick.current()
  }, [hangUp])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    for (const t of stream.current?.getAudioTracks() ?? []) t.enabled = !next
    setMuted(next)
    kick.current()
  }, [])

  return { open, closesAt, members, inCall, joining, muted, talking, connected, error, join, leave, toggleMute }
}
