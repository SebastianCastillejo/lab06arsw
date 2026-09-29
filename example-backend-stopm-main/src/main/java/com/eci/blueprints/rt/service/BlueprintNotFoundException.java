package com.eci.blueprints.rt.service;

public class BlueprintNotFoundException extends RuntimeException {
  public BlueprintNotFoundException(String author, String name) {
    super("No existe el plano " + author + "/" + name);
  }
}
