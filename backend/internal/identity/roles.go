package identity

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrForbidden          = errors.New("forbidden")
	ErrInvalidRoleMapping = errors.New("invalid_role_mapping")
	ErrRoleLockout        = errors.New("role_lockout")
)

type RoleMapping struct {
	ActorRef       string    `json:"actor_ref"`
	DisplayName    string    `json:"display_name"`
	Role           string    `json:"role"`
	Active         bool      `json:"active"`
	ApprovedBy     string    `json:"approved_by"`
	ConfiguredBy   string    `json:"configured_by"`
	ConfiguredAt   time.Time `json:"configured_at"`
	DingTalkUserID *string   `json:"dingtalk_user_id"`
}

type RoleMappingInput struct {
	ActorRef       string  `json:"actor_ref"`
	DisplayName    string  `json:"display_name"`
	Role           string  `json:"role"`
	Active         bool    `json:"active"`
	DingTalkUserID *string `json:"dingtalk_user_id"`
}

func (s *Service) ListRoles(ctx context.Context, actor Principal) ([]RoleMapping, error) {
	if actor.Role != RoleSupervisor {
		return nil, ErrForbidden
	}
	rows, err := s.db.Query(ctx, `SELECT actor_ref,display_name,role::text,active,approved_by,configured_by,configured_at,dingtalk_user_id FROM role_mapping ORDER BY active DESC,role DESC,display_name,actor_ref`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]RoleMapping, 0)
	for rows.Next() {
		var item RoleMapping
		if err := rows.Scan(&item.ActorRef, &item.DisplayName, &item.Role, &item.Active, &item.ApprovedBy, &item.ConfiguredBy, &item.ConfiguredAt, &item.DingTalkUserID); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *Service) UpsertRole(ctx context.Context, actor Principal, input RoleMappingInput) (RoleMapping, error) {
	if actor.Role != RoleSupervisor {
		return RoleMapping{}, ErrForbidden
	}
	input.ActorRef = strings.TrimSpace(input.ActorRef)
	input.DisplayName = strings.TrimSpace(input.DisplayName)
	if input.DingTalkUserID != nil {
		trimmed := strings.TrimSpace(*input.DingTalkUserID)
		if trimmed == "" {
			input.DingTalkUserID = nil
		} else {
			input.DingTalkUserID = &trimmed
		}
	}
	if input.ActorRef == "" || input.DisplayName == "" || (input.Role != RoleOperations && input.Role != RoleSupervisor) {
		return RoleMapping{}, ErrInvalidRoleMapping
	}
	if input.ActorRef == actor.ActorRef && (!input.Active || input.Role != RoleSupervisor) {
		return RoleMapping{}, ErrRoleLockout
	}
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return RoleMapping{}, err
	}
	defer tx.Rollback(ctx)
	rows, err := tx.Query(ctx, `SELECT actor_ref FROM role_mapping WHERE active AND role='supervisor' FOR UPDATE`)
	if err != nil {
		return RoleMapping{}, err
	}
	activeSupervisors := make(map[string]struct{})
	for rows.Next() {
		var ref string
		if err := rows.Scan(&ref); err != nil {
			rows.Close()
			return RoleMapping{}, err
		}
		activeSupervisors[ref] = struct{}{}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return RoleMapping{}, err
	}
	if _, targetIsSupervisor := activeSupervisors[input.ActorRef]; targetIsSupervisor && (!input.Active || input.Role != RoleSupervisor) && len(activeSupervisors) == 1 {
		return RoleMapping{}, ErrRoleLockout
	}
	var result RoleMapping
	err = tx.QueryRow(ctx, `INSERT INTO role_mapping(actor_ref,display_name,role,active,approved_by,configured_by,dingtalk_user_id)
		VALUES($1,$2,$3,$4,$5,$6,$7)
		ON CONFLICT(actor_ref) DO UPDATE SET display_name=excluded.display_name,role=excluded.role,active=excluded.active,approved_by=excluded.approved_by,configured_by=excluded.configured_by,configured_at=now(),dingtalk_user_id=excluded.dingtalk_user_id
		RETURNING actor_ref,display_name,role::text,active,approved_by,configured_by,configured_at,dingtalk_user_id`, input.ActorRef, input.DisplayName, input.Role, input.Active, actor.Name, actor.Name, input.DingTalkUserID).
		Scan(&result.ActorRef, &result.DisplayName, &result.Role, &result.Active, &result.ApprovedBy, &result.ConfiguredBy, &result.ConfiguredAt, &result.DingTalkUserID)
	if err != nil {
		return RoleMapping{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return RoleMapping{}, err
	}
	return result, nil
}
