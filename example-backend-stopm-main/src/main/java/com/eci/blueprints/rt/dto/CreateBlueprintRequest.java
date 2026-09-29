package com.eci.blueprints.rt.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.util.List;

public record CreateBlueprintRequest(
    @NotNull @Pattern(regexp = Names.PATTERN, message = Names.MESSAGE) String author,
    @NotNull @Pattern(regexp = Names.PATTERN, message = Names.MESSAGE) String name,
    List<@NotNull Point> points) {}
