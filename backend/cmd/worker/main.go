package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/config"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.Load()
	if err != nil {
		logger.Error("configuration invalid", "error", err)
		os.Exit(1)
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	db, err := pgxpool.New(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("database configuration invalid", "error", err)
		os.Exit(1)
	}
	defer db.Close()
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()
	logger.Info("worker started")
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err := db.Ping(ctx); err != nil {
				logger.Error("database unavailable", "error", err)
			}
		}
	}
}
