package com.eci.blueprints.rt.dto;

/** Author/name are used to build STOMP topics (blueprints.{author}.{name}), so dots and spaces are not allowed. */
public final class Names {
  public static final String PATTERN = "^[A-Za-z0-9_-]{1,50}$";
  public static final String MESSAGE = "solo letras, números, '_' o '-' (máx. 50)";

  private Names() {}
}
