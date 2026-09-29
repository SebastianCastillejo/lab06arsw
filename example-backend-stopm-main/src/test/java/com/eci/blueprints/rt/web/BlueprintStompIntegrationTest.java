package com.eci.blueprints.rt.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.eci.blueprints.rt.dto.BlueprintUpdate;
import com.eci.blueprints.rt.dto.DrawEvent;
import com.eci.blueprints.rt.dto.Point;
import com.eci.blueprints.rt.service.BlueprintService;
import java.lang.reflect.Type;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DirtiesContext
class BlueprintStompIntegrationTest {

  @LocalServerPort int port;
  @Autowired BlueprintService service;

  @Test
  void drawIsPersistedAndBroadcastOnlyToThatBlueprintTopic() throws Exception {
    var stomp = new WebSocketStompClient(new StandardWebSocketClient());
    stomp.setMessageConverter(new MappingJackson2MessageConverter());
    var headers = new WebSocketHttpHeaders();
    headers.setOrigin("http://localhost:5173");
    StompSession session = stomp
        .connectAsync("ws://localhost:" + port + "/ws-blueprints", headers, new StompSessionHandlerAdapter() {})
        .get(5, TimeUnit.SECONDS);

    BlockingQueue<BlueprintUpdate> plano1 = subscribe(session, "/topic/blueprints.juan.plano-1");
    BlockingQueue<BlueprintUpdate> plano2 = subscribe(session, "/topic/blueprints.juan.plano-2");
    Thread.sleep(200); // let SUBSCRIBE frames reach the broker before publishing

    session.send("/app/draw", new DrawEvent("juan", "plano-1", new Point(7, 8)));

    var upd = plano1.poll(5, TimeUnit.SECONDS);
    assertThat(upd).isNotNull();
    assertThat(upd.points()).containsExactly(new Point(7, 8));
    assertThat(upd.totalPoints()).isEqualTo(4);
    assertThat(plano2.poll(300, TimeUnit.MILLISECONDS)).isNull();
    assertThat(service.get("juan", "plano-1").points()).endsWith(new Point(7, 8));

    session.disconnect();
    stomp.stop();
  }

  @Test
  void burstOfPointsKeepsDrawingOrderInBroadcastAndStore() throws Exception {
    var stomp = new WebSocketStompClient(new StandardWebSocketClient());
    stomp.setMessageConverter(new MappingJackson2MessageConverter());
    var headers = new WebSocketHttpHeaders();
    headers.setOrigin("http://localhost:5173");
    StompSession session = stomp
        .connectAsync("ws://localhost:" + port + "/ws-blueprints", headers, new StompSessionHandlerAdapter() {})
        .get(5, TimeUnit.SECONDS);
    BlockingQueue<BlueprintUpdate> updates = subscribe(session, "/topic/blueprints.orden.rafaga");
    Thread.sleep(200);

    int burst = 300;
    for (int i = 0; i < burst; i++) session.send("/app/draw", new DrawEvent("orden", "rafaga", new Point(i, 0)));

    var received = new java.util.ArrayList<Integer>();
    for (int i = 0; i < burst; i++) {
      var upd = updates.poll(5, TimeUnit.SECONDS);
      assertThat(upd).as("update #%d", i).isNotNull();
      received.add(upd.points().get(0).x());
    }
    var expected = java.util.stream.IntStream.range(0, burst).boxed().toList();
    assertThat(received).isEqualTo(expected);
    assertThat(service.get("orden", "rafaga").points().stream().map(Point::x).toList()).isEqualTo(expected);

    session.disconnect();
    stomp.stop();
  }

  private static BlockingQueue<BlueprintUpdate> subscribe(StompSession session, String topic) {
    var queue = new LinkedBlockingQueue<BlueprintUpdate>();
    session.subscribe(topic, new StompFrameHandler() {
      @Override
      public Type getPayloadType(StompHeaders headers) {
        return BlueprintUpdate.class;
      }

      @Override
      public void handleFrame(StompHeaders headers, Object payload) {
        queue.add((BlueprintUpdate) payload);
      }
    });
    return queue;
  }
}
