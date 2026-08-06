package identity

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestSupervisorManagesRolesAgainstPostgres(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is required")
	}
	ctx := context.Background()
	db, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	refs := []string{"role-admin-supervisor", "role-admin-target"}
	defer func() {
		_, _ = db.Exec(ctx, `DELETE FROM user_session WHERE actor_ref=ANY($1); DELETE FROM role_mapping WHERE actor_ref=ANY($1)`, refs)
	}()
	_, err = db.Exec(ctx, `INSERT INTO role_mapping(actor_ref,display_name,role,approved_by,configured_by) VALUES
		($1,'角色主管','supervisor','初始化','初始化'),($2,'角色运营','operations','初始化','初始化')
		ON CONFLICT(actor_ref) DO UPDATE SET active=true,role=excluded.role`, refs[0], refs[1])
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(db)
	admin := Principal{ActorRef: refs[0], Name: "角色主管", Role: RoleSupervisor}
	if _, err := s.UpsertRole(ctx, admin, RoleMappingInput{ActorRef: refs[1], DisplayName: "新运营", Role: RoleSupervisor, Active: true}); err != nil {
		t.Fatal(err)
	}
	roles, err := s.ListRoles(ctx, admin)
	if err != nil || len(roles) < 2 {
		t.Fatalf("roles=%d err=%v", len(roles), err)
	}
	if _, err := s.UpsertRole(ctx, admin, RoleMappingInput{ActorRef: refs[0], DisplayName: "角色主管", Role: RoleOperations, Active: true}); !errors.Is(err, ErrRoleLockout) {
		t.Fatalf("self downgrade=%v", err)
	}
	if _, err := s.ListRoles(ctx, Principal{Role: RoleOperations}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("operator list=%v", err)
	}
}
