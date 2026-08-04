package config

import (
	"errors"
	"os"
	"strings"
)

type Config struct {
	Address              string
	DatabaseURL          string
	PublicBaseURL        string
	DingTalkClientID     string
	DingTalkClientSecret string
	CookieSecure         bool
}

func Load() (Config, error) {
	cfg := Config{
		Address:              value("API_ADDRESS", ":8081"),
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		PublicBaseURL:        strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/"),
		DingTalkClientID:     strings.TrimSpace(os.Getenv("DINGTALK_CLIENT_ID")),
		DingTalkClientSecret: strings.TrimSpace(os.Getenv("DINGTALK_CLIENT_SECRET")),
		CookieSecure:         value("COOKIE_SECURE", "true") == "true",
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if cfg.PublicBaseURL == "" {
		return Config{}, errors.New("PUBLIC_BASE_URL is required")
	}
	return cfg, nil
}

func value(name, fallback string) string {
	if current := strings.TrimSpace(os.Getenv(name)); current != "" {
		return current
	}
	return fallback
}
