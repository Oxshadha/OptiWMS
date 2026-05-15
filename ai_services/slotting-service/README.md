## Slotting Service

This service provides the slotting microservice runtime shell for OptiWMS AI stack.

Current endpoints:
- `GET /health` -> health check
- `POST /recommendations/slotting` -> stubbed response until recommendation logic is implemented

Run with compose from `ai-services`:

```bash
docker compose -f docker-compose.ai.yml up -d --build slotting-service
curl http://localhost:8093/health
```

Design intent:
- Keep slotting logic independent from core WMS implementation details.
- Consume WMS signals via stable contracts.
- Evolve toward model-based location recommendations without breaking API compatibility.


