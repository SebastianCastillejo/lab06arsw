// Real-time benchmark: simulates two browser tabs on the same blueprint and measures latency,
// burst delivery (loss/order) and isolation between blueprints, for STOMP and/or Socket.IO.
//
//   node scripts/bench-rt.mjs [stomp|socketio|all]          latency + burst + isolation
//   node scripts/bench-rt.mjs watch [stomp|socketio] [secs]  draws every 100 ms and logs connection
//                                                           events (kill/restart the server meanwhile)
//
// Env: STOMP_BASE (default http://localhost:8080), IO_BASE (default http://localhost:3001),
//      N (latency samples, default 200), BURST (burst size, default 1000)
import { Client } from '@stomp/stompjs'
import { io } from 'socket.io-client'

const STOMP_BASE = process.env.STOMP_BASE ?? 'http://localhost:8080'
const IO_BASE = process.env.IO_BASE ?? 'http://localhost:3001'
const N = Number(process.env.N ?? 200)
const BURST = Number(process.env.BURST ?? 1000)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now()
const t0 = Date.now()
const stamp = () => `[+${((Date.now() - t0) / 1000).toFixed(2)}s]`

/** Uniform "tab" API over both technologies: connect, join a blueprint channel, send, receive. */
function stompTab(author, name, { onPoint, onEvent = () => {} }) {
  const client = new Client({
    brokerURL: `${STOMP_BASE.replace(/^http/, 'ws')}/ws-blueprints`,
    reconnectDelay: 1000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
  })
  const ready = new Promise((resolve) => {
    client.onConnect = () => {
      client.subscribe(`/topic/blueprints.${author}.${name}`, (m) =>
        JSON.parse(m.body).points.forEach(onPoint),
      )
      onEvent('connect+subscribe')
      resolve()
    }
  })
  client.onWebSocketClose = () => onEvent('disconnect')
  client.activate()
  return {
    ready,
    connected: () => client.connected,
    send: (point) => client.publish({ destination: '/app/draw', body: JSON.stringify({ author, name, point }) }),
    close: () => client.deactivate(),
  }
}

function socketTab(author, name, { onPoint, onEvent = () => {} }) {
  const room = `blueprints.${author}.${name}`
  const socket = io(IO_BASE, { transports: ['websocket'] })
  const ready = new Promise((resolve) => {
    socket.on('connect', () => {
      socket.emit('join-room', room)
      onEvent('connect+join')
      // join-room has no ack in the guide server; give it a moment to be processed.
      setTimeout(resolve, 100)
    })
  })
  socket.on('disconnect', (reason) => onEvent(`disconnect (${reason})`))
  socket.on('blueprint-update', (upd) => upd.name === name && upd.points.forEach(onPoint))
  return {
    ready,
    connected: () => socket.connected,
    send: (point) => socket.emit('draw-event', { room, author, name, point }),
    close: () => socket.disconnect(),
  }
}

const TABS = { stomp: stompTab, socketio: socketTab }

function stats(samples) {
  const s = [...samples].sort((a, b) => a - b)
  const pct = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]
  const avg = s.reduce((a, b) => a + b, 0) / s.length
  return { n: s.length, avg: avg.toFixed(2), p50: pct(50).toFixed(2), p95: pct(95).toFixed(2), p99: pct(99).toFixed(2), max: s.at(-1).toFixed(2) }
}

async function bench(tech) {
  const tab = TABS[tech]
  const plan = `bench-${tech}-${Date.now()}`
  let waiter = null
  const received = []
  let isolatedLeaks = 0

  const a = tab('bench', plan, { onPoint: () => {} })
  const b = tab('bench', plan, {
    onPoint: (p) => {
      received.push(p)
      if (waiter && p.x === waiter.x) waiter.resolve(now())
    },
  })
  const other = tab('bench', `${plan}-other`, { onPoint: () => isolatedLeaks++ })
  await Promise.all([a.ready, b.ready, other.ready])
  await sleep(300)

  // 1) Latency: one point at a time, A -> server -> B (one-way, same machine).
  const lat = []
  for (let i = 0; i < N; i++) {
    const got = new Promise((resolve) => (waiter = { x: i, resolve }))
    const start = now()
    a.send({ x: i, y: 1 })
    const end = await Promise.race([got, sleep(2000).then(() => null)])
    if (end != null) lat.push(end - start)
  }
  waiter = null

  // 2) Burst: BURST points as fast as possible; check loss and ordering at B.
  received.length = 0
  const burstStart = now()
  for (let i = 0; i < BURST; i++) a.send({ x: 100000 + i, y: 2 })
  const deadline = now() + 10000
  while (received.length < BURST && now() < deadline) await sleep(5)
  const burstMs = now() - burstStart
  const inOrder = received.every((p, i) => i === 0 || p.x > received[i - 1].x)

  await sleep(300)
  ;[a, b, other].forEach((t) => t.close())

  return {
    tech,
    latencyMs: stats(lat),
    lostInLatencyTest: N - lat.length,
    burst: {
      sent: BURST,
      received: received.length,
      inOrder,
      totalMs: burstMs.toFixed(0),
      msgsPerSec: ((received.length / burstMs) * 1000).toFixed(0),
    },
    leaksToOtherBlueprint: isolatedLeaks,
  }
}

async function watch(tech, secs) {
  const tab = TABS[tech]
  const plan = `watch-${tech}`
  let sent = 0
  let skippedOffline = 0
  let received = 0
  const log = (who) => (e) => console.log(stamp(), who, e)
  const a = tab('bench', plan, { onPoint: () => {}, onEvent: log('A') })
  const b = tab('bench', plan, { onPoint: () => received++, onEvent: log('B') })
  await Promise.all([a.ready, b.ready])

  let i = 0
  const timer = setInterval(() => {
    // Same rule as the app: only send while connected, otherwise the point stays local.
    if (a.connected()) {
      a.send({ x: i++, y: 3 })
      sent++
    } else skippedOffline++
  }, 100)
  const report = setInterval(
    () => console.log(stamp(), `enviados=${sent} recibidosB=${received} noEnviadosOffline=${skippedOffline}`),
    1000,
  )
  await sleep(secs * 1000)
  clearInterval(timer)
  await sleep(500)
  clearInterval(report)
  console.log(stamp(), `FINAL enviados=${sent} recibidosB=${received} perdidos=${sent - received} noEnviadosOffline=${skippedOffline}`)
  a.close()
  b.close()
}

const [mode = 'all', ...rest] = process.argv.slice(2)
if (mode === 'watch') {
  await watch(rest[0] ?? 'stomp', Number(rest[1] ?? 20))
} else {
  const techs = mode === 'all' ? ['stomp', 'socketio'] : [mode]
  for (const t of techs) console.log(JSON.stringify(await bench(t), null, 2))
}
process.exit(0)
