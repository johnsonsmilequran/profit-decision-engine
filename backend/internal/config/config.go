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
	DingTalkRobotCode    string
	CookieSecure         bool
	ImportFileDir        string
	LiteLLMBaseURL       string
	LiteLLMAPIKey        string
	LiteLLMModel         string
}

func Load() (Config, error) {
	cfg := Config{
		Address:              value("API_ADDRESS", ":8081"),
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		PublicBaseURL:        strings.TrimRight(strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")), "/"),
		DingTalkClientID:     strings.TrimSpace(os.Getenv("DINGTALK_CLIENT_ID")),
		DingTalkClientSecret: strings.TrimSpace(os.Getenv("DINGTALK_CLIENT_SECRET")),
		DingTalkRobotCode:    strings.TrimSpace(os.Getenv("DINGTALK_ROBOT_CODE")),
		CookieSecure:         value("COOKIE_SECURE", "true") == "true",
		ImportFileDir:        value("IMPORT_FILE_DIR", "./var/imports"),
		LiteLLMBaseURL:       strings.TrimSpace(os.Getenv("LITELLM_BASE_URL")),
		LiteLLMAPIKey:        strings.TrimSpace(os.Getenv("LITELLM_API_KEY")),
		LiteLLMModel:         strings.TrimSpace(os.Getenv("LITELLM_MODEL")),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	if cfg.PublicBaseURL == "" {
		return Config{}, errors.New("PUBLIC_BASE_URL is required")
	}
	return cfg, nil
}

func LoadWorker() (Config, error) {
	cfg := Config{
		DatabaseURL:          strings.TrimSpace(os.Getenv("DATABASE_URL")),
		ImportFileDir:        value("IMPORT_FILE_DIR", "./var/imports"),
		DingTalkClientID:     strings.TrimSpace(os.Getenv("DINGTALK_CLIENT_ID")),
		DingTalkClientSecret: strings.TrimSpace(os.Getenv("DINGTALK_CLIENT_SECRET")),
		DingTalkRobotCode:    strings.TrimSpace(os.Getenv("DINGTALK_ROBOT_CODE")),
		LiteLLMBaseURL:       strings.TrimSpace(os.Getenv("LITELLM_BASE_URL")),
		LiteLLMAPIKey:        strings.TrimSpace(os.Getenv("LITELLM_API_KEY")),
		LiteLLMModel:         strings.TrimSpace(os.Getenv("LITELLM_MODEL")),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, errors.New("DATABASE_URL is required")
	}
	return cfg, nil
}

func value(name, fallback string) string {
	if current := strings.TrimSpace(os.Getenv(name)); current != "" {
		return current
	}
	return fallback
}
