package com.eci.blueprints.rt.web;

import com.eci.blueprints.rt.service.BlueprintAlreadyExistsException;
import com.eci.blueprints.rt.service.BlueprintNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Errors are returned as RFC 7807 ProblemDetail; validation errors (400) come from the base class. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

  @ExceptionHandler(BlueprintNotFoundException.class)
  public ProblemDetail notFound(BlueprintNotFoundException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
  }

  @ExceptionHandler(BlueprintAlreadyExistsException.class)
  public ProblemDetail conflict(BlueprintAlreadyExistsException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
  }
}
