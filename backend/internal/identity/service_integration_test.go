package identity

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSessionLifecycleAgainstPostgres(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect PostgreSQL: %v", err)
	}
	defer db.Close()

	actorRef := "integration-session-operator"
	if _, err := db.Exec(ctx, `DELETE FROM user_session WHERE actor_ref = $1`, actorRef); err != nil {
		t.Fatalf("clear integration sessions: %v", err)
	}
	if _, err := db.Exec(ctx, `DELETE FROM role_mapping WHERE actor_ref = $1`, actorRef); err != nil {
		t.Fatalf("clear integration actor: %v", err)
	}
	defer func() {
		_, _ = db.Exec(ctx, `DELETE FROM user_session WHERE actor_ref = $1`, actorRef)
		_, _ = db.Exec(ctx, `DELETE FROM role_mapping WHERE actor_ref = $1`, actorRef)
	}()
	if _, err := db.Exec(ctx, `
		INSERT INTO role_mapping(actor_ref, display_name, role, approved_by, configured_by)
		VALUES ($1, $2, 'operations', $3, $4)`, actorRef, "集成测试运营", "玩具事业部负责人", "系统运维"); err != nil {
		t.Fatalf("seed approved role: %v", err)
	}

	service := NewService(db)
	token, created, err := service.CreateSession(ctx, actorRef)
	if err != nil {
		t.Fatalf("create session: %v", err)
	}
	if token == "" || created.Name != "集成测试运营" || created.Role != RoleOperations {
		t.Fatalf("unexpected created principal: %#v", created)
	}
	authenticated, err := service.Authenticate(ctx, token)
	if err != nil {
		t.Fatalf("authenticate session: %v", err)
	}
	if authenticated.SessionID != created.SessionID || authenticated.ActorRef != actorRef {
		t.Fatalf("session identity changed: created=%#v authenticated=%#v", created, authenticated)
	}

	if _, err := db.Exec(ctx, `UPDATE role_mapping SET active = false WHERE actor_ref = $1`, actorRef); err != nil {
		t.Fatalf("deactivate role: %v", err)
	}
	if _, err := service.Authenticate(ctx, token); err != ErrUnauthenticated {
		t.Fatalf("deactivated role must be denied, got %v", err)
	}
	if err := service.Revoke(ctx, token); err != nil {
		t.Fatalf("revoke session: %v", err)
	}
}
