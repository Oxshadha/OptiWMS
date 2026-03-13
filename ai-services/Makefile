.PHONY: up down logs test

up:
	docker compose -f docker-compose.ai.yml up --build

down:
	docker compose -f docker-compose.ai.yml down

logs:
	docker compose -f docker-compose.ai.yml logs -f

test:
	@echo "Add pytest commands per service"
