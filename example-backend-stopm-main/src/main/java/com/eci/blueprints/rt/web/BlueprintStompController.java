package com.eci.blueprints.rt.web;

import com.eci.blueprints.rt.dto.BlueprintUpdate;
import com.eci.blueprints.rt.dto.DrawEvent;
import com.eci.blueprints.rt.service.BlueprintService;
import jakarta.validation.Valid;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class BlueprintStompController {

  private static final Logger log = LoggerFactory.getLogger(BlueprintStompController.class);

  private final SimpMessagingTemplate template;
  private final BlueprintService service;

  public BlueprintStompController(SimpMessagingTemplate template, BlueprintService service) {
    this.template = template;
    this.service = service;
  }

  /** Client publishes to /app/draw; the point is persisted and broadcast to everyone on the blueprint's topic. */
  @MessageMapping("/draw")
  public void onDraw(@Valid @Payload DrawEvent evt) {
    var bp = service.addPoint(evt.author(), evt.name(), evt.point());
    var upd = new BlueprintUpdate(evt.author(), evt.name(), List.of(evt.point()), bp.totalPoints());
    template.convertAndSend(topic(evt.author(), evt.name()), upd);
    log.info("STOMP draw {}/{} {} (total {})", evt.author(), evt.name(), evt.point(), bp.totalPoints());
  }

  @MessageExceptionHandler
  public void onError(Exception e) {
    log.warn("STOMP draw rechazado: {}", e.getMessage());
  }

  public static String topic(String author, String name) {
    return "/topic/blueprints." + author + "." + name;
  }
}
