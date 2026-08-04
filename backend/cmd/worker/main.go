package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/action"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/batch"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/config"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/oa"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	cfg, err := config.LoadWorker()
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
	if err := db.Ping(ctx); err != nil {
		logger.Error("database unavailable", "error", err)
		os.Exit(1)
	}
	processor := batch.NewProcessor(db)
	actions := action.NewService(db)
	actions.SetOASender(oa.NewClient(cfg.OAMessageURL, cfg.OAToken))
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	logger.Info("worker started")
	for {
		processed, err := processor.RunOne(ctx)
		if err != nil {
			logger.Error("batch job failed", "error", err)
		}
		if processed {
			continue
		}
		if _, err := actions.RunClearanceReminders(ctx); err != nil {
			logger.Error("clearance reminder failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}
