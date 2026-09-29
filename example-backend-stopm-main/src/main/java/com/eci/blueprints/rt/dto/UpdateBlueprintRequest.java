package com.eci.blueprints.rt.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public record UpdateBlueprintRequest(@NotNull List<@NotNull Point> points) {}
