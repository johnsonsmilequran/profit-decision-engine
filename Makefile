.PHONY: install lint typecheck test build migrate dev-api dev-worker compose-up

install:
	cd web && npm ci
	cd backend && go mod download

lint:
	cd web && npm run lint
	cd backend && test -z "$$(gofmt -l .)" && go vet ./...

typecheck:
	cd web && npm run typecheck

test:
	cd web && npm test
	cd backend && go test -race ./...

build:
	cd web && npm run build
	cd backend && go build ./cmd/...

migrate:
	cd backend && go run ./cmd/migrate

dev-api:
	cd backend && go run ./cmd/api

dev-worker:
	cd backend && go run ./cmd/worker

compose-up:
	docker compose up --build -d
