# backend-stomp-spring

Spring Boot 3 + STOMP over WebSocket para BluePrints RT. Expone la API CRUD REST y el canal de tiempo real.

## Run
```bash
mvn spring-boot:run
# http://localhost:8080
# WS endpoint: /ws-blueprints
# Health: /actuator/health
```

## Test
```bash
mvn test
```

Orígenes permitidos (CORS + WebSocket): variable `ALLOWED_ORIGINS` (por defecto `http://localhost:5173,http://127.0.0.1:5173`).

Endpoints y decisiones: ver el [README principal](../README.md#-readme-del-equipo-nuestra-implementación).
