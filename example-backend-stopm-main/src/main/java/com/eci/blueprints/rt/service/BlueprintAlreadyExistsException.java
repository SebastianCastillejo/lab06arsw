package com.eci.blueprints.rt.service;

public class BlueprintAlreadyExistsException extends RuntimeException {
  public BlueprintAlreadyExistsException(String author, String name) {
    super("Ya existe el plano " + author + "/" + name);
  }
}
