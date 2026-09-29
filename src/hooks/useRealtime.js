import { useCallback, useEffect, useRef, useState } from 'react'
import { createStompClient, subscribeBlueprint } from '../lib/stompClient.js'
import { createSocket } from '../lib/socketIoClient.js'

const STOMP_BASE = import.meta.env.VITE_STOMP_BASE ?? import.meta.env.VITE_API_BASE ?? 'http://localhost:8080'
const IO_BASE = import.meta.env.VITE_IO_BASE ?? 'http://localhost:3001'

/**
 * Connects to the selected RT technology on the channel `blueprints.{author}.{name}`.
 *
 * - STOMP (our Spring backend) persists each point and broadcasts it to every subscriber,
 *   including the sender, so the caller must NOT draw the point locally (`echoesToSender`).
 * - Socket.IO (guide Node backend) uses `socket.to(room)`: the sender is excluded and nothing is
 *   persisted, so the caller draws locally and saves with the REST API.
 *
 * Callbacks:
 * - `onUpdate({ points, totalPoints? })` receives the new points (delta) from the channel.
 * - `onReconnect(sendPoint)` fires when the connection comes back after a drop (not on the first
 *   connect), once the subscription/room is active again, so the caller can resync and flush.
 */
export function useRealtime(tech, author, name, { onUpdate, onReconnect }) {
  const [status, setStatus] = useState('idle')
  const callbacksRef = useRef({ onUpdate, onReconnect })
  callbacksRef.current = { onUpdate, onReconnect }
  const sendRef = useRef(() => false)
  const sendPoint = useCallback((point) => sendRef.current(point), [])

  useEffect(() => {
    sendRef.current = () => false
    if (tech === 'none' || !author || !name) {
      setStatus('idle')
      return
    }
    setStatus('connecting')
    let connectedBefore = false
    const onConnected = () => {
      setStatus('connected')
      if (connectedBefore) callbacksRef.current.onReconnect?.(sendPoint)
      connectedBefore = true
    }

    if (tech === 'stomp') {
      let unsubscribe = null
      const client = createStompClient(STOMP_BASE, { onStatus: setStatus })
      client.onConnect = () => {
        console.info(`[STOMP] ${connectedBefore ? 'reconectado' : 'conectado'}, suscrito a blueprints.${author}.${name}`)
        unsubscribe = subscribeBlueprint(client, author, name, (upd) => callbacksRef.current.onUpdate(upd))
        onConnected()
      }
      sendRef.current = (point) => {
        if (!client.connected) return false
        client.publish({ destination: '/app/draw', body: JSON.stringify({ author, name, point }) })
        return true
      }
      client.activate()
      return () => {
        unsubscribe?.()
        client.deactivate()
      }
    }

    const room = `blueprints.${author}.${name}`
    const socket = createSocket(IO_BASE)
    sendRef.current = (point) => {
      if (!socket.connected) return false
      socket.emit('draw-event', { room, author, name, point })
      return true
    }
    // (Re)join on every connect so the room survives reconnections.
    socket.on('connect', () => {
      console.info(`[Socket.IO] ${connectedBefore ? 'reconectado' : 'conectado'} (${socket.id}), join-room ${room}`)
      socket.emit('join-room', room)
      onConnected()
    })
    socket.on('disconnect', (reason) => {
      console.warn('[Socket.IO] desconectado:', reason)
      setStatus('reconnecting')
    })
    socket.on('connect_error', (err) => {
      console.error('[Socket.IO] error de conexión:', err.message)
      setStatus('error')
    })
    socket.on('blueprint-update', (upd) => {
      if (upd.author === author && upd.name === name) callbacksRef.current.onUpdate(upd)
    })
    return () => socket.disconnect()
  }, [tech, author, name, sendPoint])

  return { status, sendPoint, echoesToSender: tech === 'stomp' }
}
