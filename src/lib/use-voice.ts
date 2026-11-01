import { useCallback, useEffect, useRef, useState } from 'react'

import type { VoiceSignal } from '../../db/schema'
import { voiceSync } from './voice.functions'

// The room's voice chat: every player in the call is connected to every other one (WebRTC,
// audio only), and the server just relays the setup messages through `voiceSync`.
// To avoid both sides offering at once, the player with the smaller id always makes the offer.
// Players join as listeners when they open the room; each connection keeps an audio slot,
// and turning the mic on just puts it in there (no new connection needed).

type Member = { id: number; muted: boolean; speaking: boolean }
type Signal = VoiceSignal
type Peer = {
  pc: RTCPeerConnection
  sid: string
  audio: HTMLAudioElement
  pending: RTCIceCandidateInit[]
  startedAt: number
  // Carries my mic to them, once I turn it on
  slot?: RTCRtpTransceiver
  level?: AnalyserNode
}

const SYNC_IN_CALL_MS = 800
const SYNC_IDLE_MS = 2500
// A connection that isn't up after this long is dropped and tried again (sooner when the
// offer got no answer at all); slow phone networks can take a while to find a way through
const CONNECT_MS = 40_000
const ANSWER_MS = 10_000
// The player waiting for an offer asks for one again this often while it doesn't come
const HELLO_MS = 5000
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

export function useVoice(code: string, token: string, enabled = true) {
  const [open, setOpen] = useState(true)
  const [closesAt, setClosesAt] = useState<number | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [inCall, setInCall] = useState(false)
  const [joining, setJoining] = useState(false)
  // Listening only until the mic is turned on, so muted from the start
  const [muted, setMuted] = useState(true)
  const [micOn, setMicOn] = useState(false)
  // The browser held the sound back until the player taps the page
  const [needsTap, setNeedsTap] = useState(false)
  const [talking, setTalking] = useState<number[]>([])
  const [connected, setConnected] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  const me = useRef(0)
  const inCallRef = useRef(false)
  const mutedRef = useRef(true)
  const speakingRef = useRef(false)
  const since = useRef(0)
  // Signals sent to me before this page joined the call are for an older page: skipped
  const primed = useRef(false)
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
    setNeedsTap(true)
    const play = () => {
      setNeedsTap(false)
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
      const mic = stream.current?.getAudioTracks()[0]
      peer.slot = peer.pc.addTransceiver(mic ?? 'audio', {
        direction: 'sendrecv',
        streams: stream.current ? [stream.current] : [],
      })
      await peer.pc.setLocalDescription(await peer.pc.createOffer())
      send(id, { type: 'offer', sid: peer.sid, sdp: peer.pc.localDescription!.sdp })
    },
    [makePeer, send],
  )

  const onSignal = useCallback(
    async (from: number, s: Signal) => {
      // They opened the page again and wait for an offer, while I may still hold a connection
      // to their old page: start a new one (unless I just did)
      if (s.type === 'hello') {
        const p = peers.current.get(from)
        if (me.current < from && (!p || Date.now() - p.startedAt > HELLO_MS)) {
          closePeer(from)
          await call(from)
        }
        return
      }
      if (s.type === 'offer' && s.sdp) {
        // A new offer always starts a fresh connection
        closePeer(from)
        const peer = makePeer(from, s.sid)
        await peer.pc.setRemoteDescription({ type: 'offer', sdp: s.sdp })
        // The audio slot the offer created, opened both ways so my mic can go in it later
        peer.slot = peer.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio')
        if (peer.slot) {
          peer.slot.direction = 'sendrecv'
          const mic = stream.current?.getAudioTracks()[0]
          if (mic) await peer.slot.sender.replaceTrack(mic)
        }
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
    [closePeer, makePeer, send, call],
  )

  const hangUp = useCallback(() => {
    inCallRef.current = false
    primed.current = false
    speakingRef.current = false
    for (const id of [...peers.current.keys()]) closePeer(id)
    for (const t of stream.current?.getTracks() ?? []) t.stop()
    stream.current = null
    myLevel.current = null
    ctx.current?.close().catch(() => {})
    ctx.current = null
    outbox.current = []
    mutedRef.current = true
    setMuted(true)
    setMicOn(false)
    setNeedsTap(false)
    setInCall(false)
    setTalking([])
  }, [closePeer])

  // The sync loop: fast while in the call, slow otherwise (to show who is in it), and it stops
  // once the voice chat has closed for good
  useEffect(() => {
    if (!enabled) return // a Matchy game has no voice call
    let stop = false
    let busy = false
    let again = false
    let resend = true
    let timer: number | undefined
    // When I last asked each player for an offer
    const hello = new Map<number, number>()

    const tick = async () => {
      window.clearTimeout(timer)
      if (busy) {
        again = true
        return
      }
      busy = true
      let closed = false
      const out = outbox.current.splice(0, 60)
      const listening = inCallRef.current
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
        const fresh = primed.current
        if (listening) primed.current = true
        for (const s of res.signals) {
          since.current = s.id
          if (inCallRef.current && fresh) await onSignal(s.from, s.data).catch(() => {})
        }
        const others = res.members.filter((m) => m.id !== res.me)
        serverSpeaking.current = new Set(others.filter((m) => m.speaking).map((m) => m.id))
        setMembers((old) => (JSON.stringify(old) === JSON.stringify(res.members) ? old : res.members))
        if (inCallRef.current) {
          const ids = new Set(others.map((m) => m.id))
          for (const [id, p] of peers.current) {
            const age = Date.now() - p.startedAt
            const stuck =
              p.pc.connectionState !== 'connected' &&
              (age > CONNECT_MS || (p.pc.signalingState === 'have-local-offer' && age > ANSWER_MS))
            if (!ids.has(id) || (stuck && res.me < id)) closePeer(id)
          }
          for (const id of ids) {
            if (res.me < id && !peers.current.has(id)) await call(id)
            else if (id < res.me && !peers.current.has(id) && Date.now() - (hello.get(id) ?? 0) > HELLO_MS) {
              hello.set(id, Date.now())
              send(id, { type: 'hello', sid: crypto.randomUUID() })
            }
          }
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
  }, [enabled, code, token, onSignal, call, closePeer, hangUp, send])

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
      // The meter only works once the browser lets sound run (after a tap)
      const measuring = ctx.current?.state === 'running'
      if (inCallRef.current && measuring) {
        if (!mutedRef.current && loud(myLevel.current)) lastLoud.set(me.current, now)
        for (const [pid, p] of peers.current) if (loud(p.level)) lastLoud.set(pid, now)
        for (const [pid, t] of lastLoud) if (now - t < SPEAK_HOLD_MS) ids.push(pid)
      }
      speakingRef.current = ids.includes(me.current) && !mutedRef.current
      for (const pid of serverSpeaking.current)
        if (!(measuring && peers.current.get(pid)?.level) && !ids.includes(pid)) ids.push(pid)
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

  // Joins the call as a listener: no mic, so no permission to ask
  const connect = useCallback(() => {
    if (inCallRef.current || typeof RTCPeerConnection === 'undefined') return
    // Only measures who is talking, so the call works without it
    try {
      const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      ctx.current = AC ? new AC() : null
      ctx.current?.resume().catch(() => {})
    } catch {
      ctx.current = null
    }
    inCallRef.current = true
    setInCall(true)
    kick.current()
  }, [])

  // Everyone hears the others as soon as they open the room
  useEffect(() => {
    if (!enabled) return // a Matchy game has no voice call
    connect()
  }, [enabled, connect])

  // Asks for the mic (from a tap) and sends it to everyone I'm connected to
  const turnMicOn = useCallback(async () => {
    if (stream.current || joining) return
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
    connect()
    // During the tap itself: iPhones only let sound start from one
    ctx.current?.resume().catch(() => {})
    setJoining(true)
    setError(null)
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      })
      // Left the call while the browser was asking
      if (!inCallRef.current) {
        for (const t of mic.getTracks()) t.stop()
        return
      }
      stream.current = mic
      if (ctx.current) {
        try {
          const level = ctx.current.createAnalyser()
          level.fftSize = 512
          ctx.current.createMediaStreamSource(mic).connect(level)
          myLevel.current = level
        } catch {
          // No meter for my own voice
        }
      }
      const track = mic.getAudioTracks()[0]
      for (const p of peers.current.values()) p.slot?.sender.replaceTrack(track).catch(() => {})
      mutedRef.current = false
      setMuted(false)
      setMicOn(true)
      kick.current()
    } catch (e) {
      setError(micError(e))
    } finally {
      setJoining(false)
    }
  }, [joining, connect])

  const toggleMute = useCallback(() => {
    if (!stream.current) return void turnMicOn()
    const next = !mutedRef.current
    mutedRef.current = next
    for (const t of stream.current.getAudioTracks()) t.enabled = !next
    setMuted(next)
    kick.current()
  }, [turnMicOn])

  return {
    open,
    closesAt,
    members,
    inCall,
    joining,
    muted,
    micOn,
    needsTap,
    talking,
    connected,
    error,
    toggleMute,
  }
}
