package com.eci.blueprints.rt.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

public record DrawEvent(
    @Pattern(regexp = Names.PATTERN, message = Names.MESSAGE) String author,
    @Pattern(regexp = Names.PATTERN, message = Names.MESSAGE) String name,
    @NotNull Point point) {}
