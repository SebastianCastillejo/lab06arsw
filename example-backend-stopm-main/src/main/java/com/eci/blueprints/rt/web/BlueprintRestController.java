package com.eci.blueprints.rt.web;

import com.eci.blueprints.rt.dto.Blueprint;
import com.eci.blueprints.rt.dto.CreateBlueprintRequest;
import com.eci.blueprints.rt.dto.UpdateBlueprintRequest;
import com.eci.blueprints.rt.service.BlueprintService;
import jakarta.validation.Valid;
import java.net.URI;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/blueprints")
public class BlueprintRestController {

  private static final Logger log = LoggerFactory.getLogger(BlueprintRestController.class);

  private final BlueprintService service;

  public BlueprintRestController(BlueprintService service) {
    this.service = service;
  }

  @GetMapping
  public List<Blueprint> list(@RequestParam(required = false) String author) {
    return author == null || author.isBlank() ? service.findAll() : service.findByAuthor(author);
  }

  @GetMapping("/{author}/{name}")
  public Blueprint get(@PathVariable String author, @PathVariable String name) {
    return service.get(author, name);
  }

  @PostMapping
  public ResponseEntity<Blueprint> create(@Valid @RequestBody CreateBlueprintRequest req) {
    var created = service.create(new Blueprint(req.author(), req.name(), req.points()));
    log.info("REST create {}/{} ({} puntos)", created.author(), created.name(), created.totalPoints());
    return ResponseEntity.created(URI.create("/api/blueprints/" + created.author() + "/" + created.name()))
        .body(created);
  }

  @PutMapping("/{author}/{name}")
  public Blueprint update(
      @PathVariable String author, @PathVariable String name, @Valid @RequestBody UpdateBlueprintRequest req) {
    var updated = service.replacePoints(author, name, req.points());
    log.info("REST update {}/{} ({} puntos)", author, name, updated.totalPoints());
    return updated;
  }

  @DeleteMapping("/{author}/{name}")
  public ResponseEntity<Void> delete(@PathVariable String author, @PathVariable String name) {
    service.delete(author, name);
    log.info("REST delete {}/{}", author, name);
    return ResponseEntity.noContent().build();
  }
}
