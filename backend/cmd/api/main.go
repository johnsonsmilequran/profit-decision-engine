package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/action"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/batch"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/config"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/httpapi"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/identity"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/oa"
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
	identities := identity.NewService(db)
	dingTalk := identity.NewDingTalkClient(cfg.DingTalkClientID, cfg.DingTalkClientSecret, cfg.PublicBaseURL+"/auth/dingtalk/callback")
	batches := batch.NewService(db, cfg.ImportFileDir)
	actions := action.NewService(db)
	actions.SetOASender(oa.NewDingTalkClient(cfg.DingTalkClientID, cfg.DingTalkClientSecret, cfg.DingTalkRobotCode, "", ""))
	server := &http.Server{Addr: cfg.Address, Handler: httpapi.New(db, identities, dingTalk, batches, actions, cfg.PublicBaseURL, cfg.CookieSecure, logger), ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdown)
	}()
	logger.Info("api starting", "address", cfg.Address)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		logger.Error("api stopped", "error", err)
		os.Exit(1)
	}
}
