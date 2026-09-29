package com.eci.blueprints.rt.dto;

import java.util.List;

/** RT message sent to /topic/blueprints.{author}.{name}: the new points (delta) plus the resulting total. */
public record BlueprintUpdate(String author, String name, List<Point> points, int totalPoints) {}
