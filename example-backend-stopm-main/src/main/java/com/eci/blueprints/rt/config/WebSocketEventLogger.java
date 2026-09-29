package com.eci.blueprints.rt.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

/** Logs the STOMP session lifecycle so connections and subscriptions can be observed during the demo. */
@Component
public class WebSocketEventLogger {

  private static final Logger log = LoggerFactory.getLogger(WebSocketEventLogger.class);

  @EventListener
  public void onConnected(SessionConnectedEvent e) {
    log.info("WS conectado session={}", StompHeaderAccessor.wrap(e.getMessage()).getSessionId());
  }

  @EventListener
  public void onSubscribe(SessionSubscribeEvent e) {
    var h = StompHeaderAccessor.wrap(e.getMessage());
    log.info("WS suscripcion session={} destino={}", h.getSessionId(), h.getDestination());
  }

  @EventListener
  public void onUnsubscribe(SessionUnsubscribeEvent e) {
    log.info("WS desuscripcion session={}", StompHeaderAccessor.wrap(e.getMessage()).getSessionId());
  }

  @EventListener
  public void onDisconnect(SessionDisconnectEvent e) {
    log.info("WS desconectado session={} status={}", e.getSessionId(), e.getCloseStatus());
  }
}
