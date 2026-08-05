package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	RoleOperations = "operations"
	RoleSupervisor = "supervisor"
)

var ErrUnauthenticated = errors.New("unauthenticated")

type Principal struct {
	ActorRef  string `json:"-"`
	Name      string `json:"name"`
	Role      string `json:"role"`
	SessionID string `json:"-"`
}

type Service struct {
	db  *pgxpool.Pool
	now func() time.Time
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db, now: time.Now}
}

func (s *Service) CreateSession(ctx context.Context, actorRef string) (string, Principal, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", Principal{}, err
	}
	token := base64.RawURLEncoding.EncodeToString(raw)
	digest := sha256.Sum256([]byte(token))
	var principal Principal
	err := s.db.QueryRow(ctx, `
		INSERT INTO user_session(token_digest, actor_ref, role, absolute_expires_at)
		SELECT $1, actor_ref, role, $3
		FROM role_mapping
		WHERE actor_ref = $2 AND active
		RETURNING actor_ref, (SELECT display_name FROM role_mapping WHERE actor_ref = $2), role::text, session_id::text`,
		digest[:], actorRef, s.now().Add(12*time.Hour),
	).Scan(&principal.ActorRef, &principal.Name, &principal.Role, &principal.SessionID)
	if err != nil {
		return "", Principal{}, ErrUnauthenticated
	}
	return token, principal, nil
}

func (s *Service) Authenticate(ctx context.Context, token string) (Principal, error) {
	if token == "" {
		return Principal{}, ErrUnauthenticated
	}
	digest := sha256.Sum256([]byte(token))
	var principal Principal
	err := s.db.QueryRow(ctx, `
		UPDATE user_session AS s
		SET last_seen_at = now()
		FROM role_mapping AS r
		WHERE s.token_digest = $1
		  AND s.actor_ref = r.actor_ref
		  AND s.revoked_at IS NULL
		  AND s.absolute_expires_at > now()
		  AND s.last_seen_at > now() - interval '2 hours'
		  AND r.active
		  AND r.role = s.role
		RETURNING s.actor_ref, r.display_name, s.role::text, s.session_id::text`, digest[:],
	).Scan(&principal.ActorRef, &principal.Name, &principal.Role, &principal.SessionID)
	if err != nil {
		return Principal{}, ErrUnauthenticated
	}
	return principal, nil
}

func (s *Service) Revoke(ctx context.Context, token string) error {
	digest := sha256.Sum256([]byte(token))
	_, err := s.db.Exec(ctx, `UPDATE user_session SET revoked_at = now() WHERE token_digest = $1 AND revoked_at IS NULL`, digest[:])
	return err
}
