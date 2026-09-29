import { Client } from '@stomp/stompjs'

export function createStompClient(baseUrl, { onStatus } = {}) {
  const wsUrl = `${baseUrl.replace(/\/$/, '').replace(/^http/, 'ws')}/ws-blueprints`
  const client = new Client({
    brokerURL: wsUrl,
    reconnectDelay: 1000,
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    onStompError: (f) => {
      console.error('[STOMP] error', f.headers['message'])
      onStatus?.('error')
    },
    onWebSocketClose: () => onStatus?.('reconnecting'),
  })
  return client
}

/** Subscribes to the blueprint topic and returns an unsubscribe function. */
export function subscribeBlueprint(client, author, name, onMsg) {
  const sub = client.subscribe(`/topic/blueprints.${author}.${name}`, (m) => {
    onMsg(JSON.parse(m.body))
  })
  return () => sub.unsubscribe()
}
