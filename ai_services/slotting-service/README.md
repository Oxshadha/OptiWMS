## Slotting Service (AI Microservice Stub)

This folder is reserved for an AI microservice that will provide slotting recommendations.

Expected responsibilities:
- Read warehouse layout and historical movement data via events or APIs.
- Expose an internal HTTP API such as `/internal/ai/recommendations/slotting` that returns suggested storage locations.
- Remain independent from the core WMS so it can be replaced or scaled separately.

Implementation is intentionally minimal at this stage; fill in with your preferred stack (e.g. Python/FastAPI or Spring Boot) when ready.


