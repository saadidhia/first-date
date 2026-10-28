import { useEffect, useState } from 'react'

import type { VoiceSignal } from '../../db/schema'
import { adminVoiceSync } from './voice.functions'

// An admin listening to a room's call: one receive-only WebRTC connection to every player in it.
// The admin's address is negative (smaller than any player id), so it always makes the offer,
// the same rule the players use between themselves.

type Peer = {
  pc: RTCPeerConnection
  sid: string
  audio: HTMLAudioElement
  pending: RTCIceCandidateInit[]
  startedAt: number
}

const SYNC_MS = 800
const CONNECT_MS = 40_000
const ANSWER_MS = 10_000
const HELLO_MS = 5000

export function useListen(code: string) {
  const [on, setOn] = useState(false)
  // Players whose audio reaches me right now
  const [connected, setConnected] = useState<number[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!on) return
    let stop = false
    let busy = false
    let again = false
    let resend = true
    let timer: number | undefined
    let listener = 0
    let since = 0
    let ice: RTCIceServer[] = []
    let outbox: { to: number; data: VoiceSignal }[] = []
    const peers = new Map<number, Peer>()

    const refresh = () => {
      const ids = [...peers]
        .filter(([, p]) => p.pc.connectionState === 'connected')
        .map(([id]) => id)
        .sort((a, b) => a - b)
      setConnected((old) => (old.join() === ids.join() ? old : ids))
    }

    const close = (id: number) => {
      const p = peers.get(id)
      if (!p) return
      peers.delete(id)
      p.pc.close()
      p.audio.srcObject = null
      p.audio.remove()
      refresh()
    }

    const kick = (soon?: boolean) => {
      if (stop) return
      window.clearTimeout(timer)
      timer = window.setTimeout(tick, soon ? 100 : 0)
    }

    const send = (to: number, data: VoiceSignal) => {
      outbox.push({ to, data })
      kick(true)
    }

    const call = async (id: number) => {
      close(id)
      const sid = crypto.randomUUID()
      const pc = new RTCPeerConnection({ iceServers: ice })
      const audio = document.createElement('audio')
      audio.autoplay = true
      audio.setAttribute('playsinline', '')
      audio.hidden = true
      document.body.appendChild(audio)
      const peer: Peer = { pc, sid, audio, pending: [], startedAt: Date.now() }
      peers.set(id, peer)
      pc.onicecandidate = (e) => {
        if (e.candidate)
          send(id, { type: 'ice', sid, candidate: e.candidate.toJSON() })
      }
      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0] ?? new MediaStream([e.track])
        // The admin tapped the button, so this normally plays; otherwise on the next tap
        audio
          .play()
          .catch(() =>
            document.addEventListener(
              'pointerdown',
              () => audio.play().catch(() => {}),
              { once: true },
            ),
          )
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' && peers.get(id) === peer) close(id)
        refresh()
      }
      // Only hearing them: nothing goes the other way
      pc.addTransceiver('audio', { direction: 'recvonly' })
      await pc.setLocalDescription(await pc.createOffer())
      send(id, { type: 'offer', sid, sdp: pc.localDescription!.sdp })
    }

    const onSignal = async (from: number, s: VoiceSignal) => {
      // They opened the page again and wait for an offer
      if (s.type === 'hello') {
        const p = peers.get(from)
        if (!p || Date.now() - p.startedAt > HELLO_MS) await call(from)
        return
      }
      const peer = peers.get(from)
      if (!peer || peer.sid !== s.sid) return
      if (s.type === 'answer') {
        if (peer.pc.signalingState !== 'have-local-offer' || !s.sdp) return
        await peer.pc.setRemoteDescription({ type: 'answer', sdp: s.sdp })
        for (const c of peer.pending.splice(0))
          await peer.pc.addIceCandidate(c).catch(() => {})
      } else if (s.candidate) {
        if (peer.pc.remoteDescription)
          await peer.pc.addIceCandidate(s.candidate).catch(() => {})
        else peer.pending.push(s.candidate)
      }
    }

    async function tick() {
      window.clearTimeout(timer)
      if (busy) {
        again = true
        return
      }
      busy = true
      const out = outbox.splice(0, 60)
      try {
        const res = await adminVoiceSync({
          data: { code, listener, since, out },
        })
        if (stop) return
        if (!res.open) {
          setError('المكالمة متاع اللعبة هذي تسكّرت')
          setOn(false)
          return
        }
        // A new listener: whatever was set up for the old one is gone
        if (res.listener !== listener) {
          listener = res.listener
          since = 0
          outbox = []
          for (const id of [...peers.keys()]) close(id)
        }
        ice = res.iceServers
        for (const s of res.signals) {
          since = s.id
          await onSignal(s.from, s.data).catch(() => {})
        }
        const ids = new Set(res.members.map((m) => m.id))
        for (const [id, p] of peers) {
          const age = Date.now() - p.startedAt
          const stuck =
            p.pc.connectionState !== 'connected' &&
            (age > CONNECT_MS ||
              (p.pc.signalingState === 'have-local-offer' && age > ANSWER_MS))
          if (!ids.has(id) || stuck) close(id)
        }
        for (const id of ids) if (!peers.has(id)) await call(id)
        resend = true
        setError(null)
      } catch {
        // Retried on the next tick, with the messages it didn't get to send (once: a message
        // the server refuses must not block the ones after it)
        if (resend) outbox.unshift(...out)
        resend = false
      } finally {
        busy = false
        if (!stop) {
          timer = window.setTimeout(
            tick,
            again || outbox.length ? 100 : SYNC_MS,
          )
          again = false
        }
      }
    }

    tick()
    return () => {
      stop = true
      window.clearTimeout(timer)
      for (const id of [...peers.keys()]) close(id)
      setConnected([])
      if (listener)
        adminVoiceSync({ data: { code, listener, leave: true } }).catch(
          () => {},
        )
    }
  }, [on, code])

  const start = () => {
    if (typeof RTCPeerConnection === 'undefined')
      return setError('المتصفّح هذا ما يخلّيكش تسمع')
    setError(null)
    setOn(true)
  }

  return { on, connected, error, start, stop: () => setOn(false) }
}
