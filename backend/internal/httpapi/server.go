package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/batch"
	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/identity"
)

const sessionCookie = "quran_session"

type Server struct {
	db           *pgxpool.Pool
	identity     *identity.Service
	dingTalk     *identity.DingTalkClient
	batches      *batch.Service
	publicURL    string
	cookieSecure bool
	logger       *slog.Logger
}

func New(db *pgxpool.Pool, identities *identity.Service, dingTalk *identity.DingTalkClient, batches *batch.Service, publicURL string, cookieSecure bool, logger *slog.Logger) http.Handler {
	s := &Server{db: db, identity: identities, dingTalk: dingTalk, batches: batches, publicURL: publicURL, cookieSecure: cookieSecure, logger: logger}
	r := chi.NewRouter()
	r.Get("/health/live", s.live)
	r.Get("/health/ready", s.ready)
	r.Get("/auth/dingtalk/start", s.startDingTalk)
	r.Get("/auth/dingtalk/callback", s.finishDingTalk)
	r.Post("/auth/logout", s.logout)
	r.Get("/api/session", s.session)
	r.Get("/api/batches", s.listBatches)
	r.Post("/api/batches", s.createBatch)
	r.Get("/api/batches/{batchID}", s.getBatch)
	return r
}

func (s *Server) createBatch(w http.ResponseWriter, r *http.Request) {
	principal, err := s.authenticate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication_required")
		return
	}
	if principal.Role != identity.RoleOperations {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_multipart_form")
		return
	}
	periodStart, err := parseBusinessDate(r.FormValue("period_start"))
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_period_start")
		return
	}
	periodEnd, err := parseBusinessDate(r.FormValue("period_end"))
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_period_end")
		return
	}
	cutoff, err := parseBusinessDate(r.FormValue("business_cutoff_date"))
	if err != nil || batch.ValidatePeriod(periodStart, periodEnd, cutoff) != nil {
		writeError(w, http.StatusUnprocessableEntity, "invalid_complete_natural_month")
		return
	}
	if r.FormValue("business_unit") != "玩具事业部" {
		writeError(w, http.StatusUnprocessableEntity, "invalid_business_unit")
		return
	}
	file, header, err := r.FormFile("xlsx_file")
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "xlsx_file_required")
		return
	}
	defer file.Close()
	fileName := filepath.Base(strings.TrimSpace(header.Filename))
	if !strings.EqualFold(filepath.Ext(fileName), ".xlsx") {
		writeError(w, http.StatusUnprocessableEntity, "xlsx_file_required")
		return
	}
	filePath, digest, err := s.batches.StoreUpload(file)
	if err != nil {
		s.logger.Error("store batch upload", "error", err)
		writeError(w, http.StatusInternalServerError, "file_storage_unavailable")
		return
	}
	created, err := s.batches.Create(r.Context(), batch.Principal{ActorRef: principal.ActorRef, Name: principal.Name, Role: principal.Role}, batch.CreateInput{
		BusinessUnit: "玩具事业部", PeriodStart: periodStart, PeriodEnd: periodEnd, CutoffDate: cutoff,
		FileName: fileName, FilePath: filePath, FileSHA256: digest, CreatedBy: principal.ActorRef,
	})
	if err != nil {
		s.logger.Error("create batch", "error", err)
		writeError(w, http.StatusInternalServerError, "batch_creation_failed")
		return
	}
	status := http.StatusCreated
	if created.Idempotent {
		status = http.StatusOK
	}
	writeJSON(w, status, created)
}

func (s *Server) listBatches(w http.ResponseWriter, r *http.Request) {
	principal, err := s.authenticate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication_required")
		return
	}
	limit := queryInt(r, "limit", 50)
	if limit != 20 && limit != 50 && limit != 100 {
		limit = 50
	}
	page := queryInt(r, "page", 1)
	if page < 1 {
		page = 1
	}
	items, total, err := s.batches.List(r.Context(), batch.Principal{ActorRef: principal.ActorRef, Name: principal.Name, Role: principal.Role}, limit, (page-1)*limit)
	if errors.Is(err, batch.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if err != nil {
		s.logger.Error("list batches", "error", err)
		writeError(w, http.StatusInternalServerError, "batch_query_failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"items": items, "page": page, "limit": limit, "total": total})
}

func (s *Server) getBatch(w http.ResponseWriter, r *http.Request) {
	principal, err := s.authenticate(r)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "authentication_required")
		return
	}
	item, err := s.batches.Get(r.Context(), batch.Principal{ActorRef: principal.ActorRef, Name: principal.Name, Role: principal.Role}, chi.URLParam(r, "batchID"))
	if errors.Is(err, batch.ErrForbidden) {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if errors.Is(err, batch.ErrNotFound) {
		writeError(w, http.StatusNotFound, "not_found")
		return
	}
	if err != nil {
		s.logger.Error("get batch", "error", err)
		writeError(w, http.StatusInternalServerError, "batch_query_failed")
		return
	}
	writeJSON(w, http.StatusOK, item)
}

func parseBusinessDate(raw string) (time.Time, error) {
	location, _ := time.LoadLocation("Asia/Shanghai")
	return time.ParseInLocation("2006-01-02", strings.TrimSpace(raw), location)
}

func queryInt(r *http.Request, key string, fallback int) int {
	value, err := strconv.Atoi(r.URL.Query().Get(key))
	if err != nil {
		return fallback
	}
	return value
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
