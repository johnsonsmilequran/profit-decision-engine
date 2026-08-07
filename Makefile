.PHONY: install lint typecheck test build check-dev-env migrate dev-api dev-worker dev-web infra-up infra-down infra-status infra-logs prod-up compose-up backup restore

DEV_ENV_FILE ?= .env.development
INFRA_ENV_FILE ?= infra/.env
INFRA_COMPOSE = docker compose --env-file $(INFRA_ENV_FILE) -f infra/compose.yaml

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

check-dev-env:
	@test -f "$(DEV_ENV_FILE)" || { echo "缺少 $(DEV_ENV_FILE)，请先复制 .env.development.example" >&2; exit 1; }

migrate: check-dev-env
	set -a; . ./$(DEV_ENV_FILE); set +a; cd backend && go run ./cmd/migrate

dev-api: check-dev-env
	set -a; . ./$(DEV_ENV_FILE); set +a; cd backend && go run ./cmd/api

dev-worker: check-dev-env
	set -a; . ./$(DEV_ENV_FILE); set +a; cd backend && go run ./cmd/worker

dev-web:
	cd web && npm run dev

infra-up:
	@test -f "$(INFRA_ENV_FILE)" || { echo "缺少 $(INFRA_ENV_FILE)，请先复制 infra/.env.example" >&2; exit 1; }
	$(INFRA_COMPOSE) up -d

infra-down:
	@test -f "$(INFRA_ENV_FILE)" || { echo "缺少 $(INFRA_ENV_FILE)，请先复制 infra/.env.example" >&2; exit 1; }
	$(INFRA_COMPOSE) down

infra-status:
	@test -f "$(INFRA_ENV_FILE)" || { echo "缺少 $(INFRA_ENV_FILE)，请先复制 infra/.env.example" >&2; exit 1; }
	$(INFRA_COMPOSE) ps

infra-logs:
	@test -f "$(INFRA_ENV_FILE)" || { echo "缺少 $(INFRA_ENV_FILE)，请先复制 infra/.env.example" >&2; exit 1; }
	$(INFRA_COMPOSE) logs -f db

prod-up:
	@test -f .env || { echo "缺少线上部署配置 .env，请先由运维从 .env.example 创建" >&2; exit 1; }
	docker compose --env-file .env -f compose.yaml up --build -d

compose-up:
	@echo "compose-up 环境含义不明确；开发基础设施请用 make infra-up，线上部署请用 make prod-up" >&2
	@exit 2

backup:
	./deploy/backup.sh

restore:
	./deploy/restore.sh
