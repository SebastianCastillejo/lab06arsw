package com.eci.blueprints.rt.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;

public record Blueprint(String author, String name, List<Point> points) {

  public Blueprint {
    points = points == null ? List.of() : List.copyOf(points);
  }

  @JsonProperty("totalPoints")
  public int totalPoints() {
    return points.size();
  }
}
