.PHONY: app jaeger_up jaeger_down jaeger_logs collector_up collector_down collector_logs client services_up services_down

app:
	node src/app.mjs

service_up:
	@echo "Starting all services..."
	@node src/service-a.mjs &
	@node src/service-b.mjs &
	@node src/service-c.mjs &
	@echo "All services started (A:3001, B:3002, C:3003)"

service_down:
	@echo "Stopping all services..."
	@pkill -f "service-a.mjs" 2>/dev/null || true
	@pkill -f "service-b.mjs" 2>/dev/null || true
	@pkill -f "service-c.mjs" 2>/dev/null || true
	@sleep 1
	@lsof -ti :3001 | xargs kill -9 2>/dev/null || true
	@lsof -ti :3002 | xargs kill -9 2>/dev/null || true
	@lsof -ti :3003 | xargs kill -9 2>/dev/null || true
	@echo "All services stopped"

# Client with both functions
client:
	node src/client.mjs

jaeger_up:
	docker compose --profile jaeger up -d

jaeger_down:
	docker compose --profile jaeger down

jaeger_logs:
	docker compose logs -f otel-jaeger

collector_up:
	docker compose --profile collector up -d

collector_down:
	docker compose --profile collector down

collector_logs:
	docker compose logs -f otel-collector

collector_contrib_up:
	docker compose --profile collector-contrib up -d

collector_contrib_down:
	docker compose --profile collector-contrib down

collector_contrib_logs:
	docker compose logs -f otel-collector-contrib
