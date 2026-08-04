package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/identity"
)

const sessionCookie = "quran_session"

type Server struct {
	db           *pgxpool.Pool
	identity     *identity.Service
	dingTalk     *identity.DingTalkClient
	publicURL    string
	cookieSecure bool
	logger       *slog.Logger
}

func New(db *pgxpool.Pool, identities *identity.Service, dingTalk *identity.DingTalkClient, publicURL string, cookieSecure bool, logger *slog.Logger) http.Handler {
	s := &Server{db: db, identity: identities, dingTalk: dingTalk, publicURL: publicURL, cookieSecure: cookieSecure, logger: logger}
	r := chi.NewRouter()
	r.Get("/health/live", s.live)
	r.Get("/health/ready", s.ready)
	r.Get("/auth/dingtalk/start", s.startDingTalk)
	r.Get("/auth/dingtalk/callback", s.finishDingTalk)
	r.Post("/auth/logout", s.logout)
	r.Get("/api/session", s.session)
	return r
}

func (s *Server) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	if err := s.db.Ping(ctx); err != nil {
		writeError(w, http.StatusServiceUnavailable, "service_unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) startDingTalk(w http.ResponseWriter, r *http.Request) {
	state, err := randomToken(24)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "authentication_unavailable")
		return
	}
	returnTo := safeReturn(r.URL.Query().Get("return_to"))
	http.SetCookie(w, &http.Cookie{Name: "quran_oauth_state", Value: state + "." + base64.RawURLEncoding.EncodeToString([]byte(returnTo)), Path: "/auth/dingtalk", HttpOnly: true, Secure: s.cookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: 600})
	target, err := s.dingTalk.AuthorizationURL(state)
	if err != nil {
		http.Redirect(w, r, "/auth/recovery?reason=network", http.StatusFound)
		return
	}
	http.Redirect(w, r, target, http.StatusFound)
}

func (s *Server) finishDingTalk(w http.ResponseWriter, r *http.Request) {
	stateCookie, err := r.Cookie("quran_oauth_state")
	if err != nil {
		http.Redirect(w, r, "/auth/recovery?reason=auth_failed", http.StatusFound)
		return
	}
	parts := strings.SplitN(stateCookie.Value, ".", 2)
	if len(parts) != 2 || parts[0] == "" || parts[0] != r.URL.Query().Get("state") {
		http.Redirect(w, r, "/auth/recovery?reason=auth_failed", http.StatusFound)
		return
	}
	returnBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		returnBytes = []byte("/")
	}
	accessToken, err := s.dingTalk.Exchange(r.Context(), r.URL.Query().Get("code"))
	if err != nil {
		http.Redirect(w, r, "/auth/recovery?reason=auth_failed", http.StatusFound)
		return
	}
	actorRef, err := s.dingTalk.CurrentUser(r.Context(), accessToken)
	if err != nil {
		http.Redirect(w, r, "/auth/recovery?reason=auth_failed", http.StatusFound)
		return
	}
	token, principal, err := s.identity.CreateSession(r.Context(), actorRef)
	if err != nil {
		http.Redirect(w, r, "/auth/recovery?reason=no_role", http.StatusFound)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Value: token, Path: "/", HttpOnly: true, Secure: s.cookieSecure, SameSite: http.SameSiteLaxMode, MaxAge: 43200})
	target := safeReturn(string(returnBytes))
	if target == "/" {
		if principal.Role == identity.RoleSupervisor {
			target = "/workbench/supervisor"
		} else {
			target = "/workbench/operations"
		}
	}
	http.Redirect(w, r, target, http.StatusFound)
}

func (s *Server) session(w http.ResponseWriter, r *http.Request) {
	principal, err := s.authenticate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication_required")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"authenticated": true, "user": principal})
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookie)
	if err == nil {
		_ = s.identity.Revoke(r.Context(), cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{Name: sessionCookie, Path: "/", MaxAge: -1, HttpOnly: true, Secure: s.cookieSecure, SameSite: http.SameSiteLaxMode})
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) authenticate(r *http.Request) (identity.Principal, error) {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return identity.Principal{}, identity.ErrUnauthenticated
	}
	return s.identity.Authenticate(r.Context(), cookie.Value)
}

func safeReturn(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.IsAbs() || parsed.Host != "" || !strings.HasPrefix(parsed.Path, "/") || strings.HasPrefix(parsed.Path, "//") || strings.HasPrefix(parsed.Path, "/auth/dingtalk") {
		return "/"
	}
	return parsed.RequestURI()
}
func randomToken(size int) (string, error) {
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}
func writeError(w http.ResponseWriter, status int, code string) {
	writeJSONStatus(w, status, map[string]interface{}{"error": map[string]string{"code": code, "message": "请求无法完成，请按页面指引重试"}})
}
func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	writeJSONStatus(w, status, value)
}
func writeJSONStatus(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
