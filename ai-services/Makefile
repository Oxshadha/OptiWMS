.PHONY: up down logs test up-slotting pv2-ready

up:
	docker compose -f docker-compose.ai.yml up --build

down:
	docker compose -f docker-compose.ai.yml down

logs:
	docker compose -f docker-compose.ai.yml logs -f

test:
	@echo "Add pytest commands per service"

up-slotting:
	docker compose -f docker-compose.ai.yml up -d --build slotting-service

pv2-ready:
	bash scripts/pv2_publish_and_gate.sh
