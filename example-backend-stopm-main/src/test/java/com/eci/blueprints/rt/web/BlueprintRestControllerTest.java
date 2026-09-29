package com.eci.blueprints.rt.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class BlueprintRestControllerTest {

  @Autowired MockMvc mvc;

  @Test
  void listsBlueprintsByAuthorWithTotals() throws Exception {
    mvc.perform(get("/api/blueprints").param("author", "juan"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].name").value("plano-1"))
        .andExpect(jsonPath("$[0].totalPoints").value(3));
  }

  @Test
  void createUpdateDeleteLifecycle() throws Exception {
    mvc.perform(post("/api/blueprints").contentType(MediaType.APPLICATION_JSON)
            .content("{\"author\":\"ana\",\"name\":\"nuevo\",\"points\":[{\"x\":1,\"y\":2}]}"))
        .andExpect(status().isCreated())
        .andExpect(header().string("Location", "/api/blueprints/ana/nuevo"))
        .andExpect(jsonPath("$.totalPoints").value(1));

    mvc.perform(post("/api/blueprints").contentType(MediaType.APPLICATION_JSON)
            .content("{\"author\":\"ana\",\"name\":\"nuevo\"}"))
        .andExpect(status().isConflict());

    mvc.perform(put("/api/blueprints/ana/nuevo").contentType(MediaType.APPLICATION_JSON)
            .content("{\"points\":[{\"x\":1,\"y\":2},{\"x\":3,\"y\":4}]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.points[1].x").value(3));

    mvc.perform(delete("/api/blueprints/ana/nuevo")).andExpect(status().isNoContent());
    mvc.perform(get("/api/blueprints/ana/nuevo"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.detail").value("No existe el plano ana/nuevo"));
  }

  @Test
  void rejectsNamesThatWouldBreakTopics() throws Exception {
    mvc.perform(post("/api/blueprints").contentType(MediaType.APPLICATION_JSON)
            .content("{\"author\":\"a.b\",\"name\":\"x\"}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void allowsCorsFromViteDevServer() throws Exception {
    mvc.perform(options("/api/blueprints/juan/plano-1")
            .header("Origin", "http://localhost:5173")
            .header("Access-Control-Request-Method", "PUT"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
  }
}
