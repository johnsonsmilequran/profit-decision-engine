package batch

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrForbidden    = errors.New("forbidden")
	ErrNotFound     = errors.New("not found")
	ErrInvalidInput = errors.New("invalid batch input")
)

type Service struct {
	db      *pgxpool.Pool
	fileDir string
}

func NewService(db *pgxpool.Pool, fileDir string) *Service {
	return &Service{db: db, fileDir: fileDir}
}

func (s *Service) StoreUpload(source io.Reader) (string, []byte, error) {
	if err := os.MkdirAll(s.fileDir, 0o750); err != nil {
		return "", nil, fmt.Errorf("create import directory: %w", err)
	}
	temporary, err := os.CreateTemp(s.fileDir, ".upload-*.xlsx")
	if err != nil {
		return "", nil, fmt.Errorf("create import file: %w", err)
	}
	temporaryPath := temporary.Name()
	committed := false
	defer func() {
		_ = temporary.Close()
		if !committed {
			_ = os.Remove(temporaryPath)
		}
	}()
	hash := sha256.New()
	if _, err := io.Copy(io.MultiWriter(temporary, hash), source); err != nil {
		return "", nil, fmt.Errorf("persist import file: %w", err)
	}
	if err := temporary.Sync(); err != nil {
		return "", nil, fmt.Errorf("sync import file: %w", err)
	}
	if err := temporary.Close(); err != nil {
		return "", nil, fmt.Errorf("close import file: %w", err)
	}
	digest := hash.Sum(nil)
	finalPath := filepath.Join(s.fileDir, hex.EncodeToString(digest)+".xlsx")
	if err := os.Rename(temporaryPath, finalPath); err != nil {
		if _, statErr := os.Stat(finalPath); statErr != nil {
			return "", nil, fmt.Errorf("commit import file: %w", err)
		}
		if removeErr := os.Remove(temporaryPath); removeErr != nil && !errors.Is(removeErr, os.ErrNotExist) {
			return "", nil, fmt.Errorf("discard duplicate import file: %w", removeErr)
		}
	}
	committed = true
	return finalPath, digest, nil
}

func (s *Service) Create(ctx context.Context, actor Principal, input CreateInput) (Summary, error) {
	if actor.Role != "operations" {
		return Summary{}, ErrForbidden
	}
	if input.BusinessUnit != "玩具事业部" || ValidatePeriod(input.PeriodStart, input.PeriodEnd, input.CutoffDate) != nil {
		return Summary{}, ErrInvalidInput
	}
	fingerprint := sha256.Sum256([]byte(strings.Join([]string{
		input.BusinessUnit,
		input.PeriodStart.Format("2006-01-02"),
		input.PeriodEnd.Format("2006-01-02"),
		input.CutoffDate.Format("2006-01-02"),
		hex.EncodeToString(input.FileSHA256),
	}, "\x00")))
	tx, err := s.db.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return Summary{}, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, hex.EncodeToString(fingerprint[:])); err != nil {
		return Summary{}, err
	}
	var existing Summary
	if err := scanSummary(tx.QueryRow(ctx, summarySelect+` WHERE fingerprint = $1`, fingerprint[:]), &existing); err == nil {
		existing.Idempotent = true
		if err := tx.Commit(ctx); err != nil {
			return Summary{}, err
		}
		return existing, nil
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Summary{}, err
	}
	var batchID string
	if err := tx.QueryRow(ctx, `SELECT gen_random_uuid()::text`).Scan(&batchID); err != nil {
		return Summary{}, err
	}
	batchCode := "BATCH-" + input.CutoffDate.Format("20060102") + "-" + strings.ToUpper(strings.ReplaceAll(batchID, "-", "")[:8])
	_, err = tx.Exec(ctx, `
		INSERT INTO import_batch(
			batch_id, batch_code, fingerprint, business_unit, period_start, period_end,
			business_cutoff_date, source_file_name, source_file_path, source_file_sha256,
			status, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'received', $11)`,
		batchID, batchCode, fingerprint[:], input.BusinessUnit, input.PeriodStart, input.PeriodEnd,
		input.CutoffDate, input.FileName, input.FilePath, input.FileSHA256, actor.ActorRef)
	if err != nil {
		return Summary{}, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO job(job_type, business_key, payload)
		VALUES ('process_batch', $1, jsonb_build_object('batch_id', $2::text))`, "process_batch:"+batchID, batchID)
	if err != nil {
		return Summary{}, err
	}
	var result Summary
	if err := scanSummary(tx.QueryRow(ctx, summarySelect+` WHERE batch_id = $1`, batchID), &result); err != nil {
		return Summary{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return Summary{}, err
	}
	return result, nil
}

func (s *Service) List(ctx context.Context, actor Principal, search string, limit, offset int) ([]Summary, int, error) {
	if actor.Role != "operations" && actor.Role != "supervisor" {
		return nil, 0, ErrForbidden
	}
	search = strings.TrimSpace(search)
	var total int
	const searchWhere = ` WHERE ($1 = '' OR batch_code ILIKE '%' || $1 || '%' OR source_file_name ILIKE '%' || $1 || '%')`
	if err := s.db.QueryRow(ctx, `SELECT count(*) FROM import_batch`+searchWhere, search).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.db.Query(ctx, summarySelect+searchWhere+` ORDER BY created_at DESC, batch_id DESC LIMIT $2 OFFSET $3`, search, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	items := make([]Summary, 0)
	for rows.Next() {
		var item Summary
		if err := scanSummary(rows, &item); err != nil {
			return nil, 0, err
		}
		items = append(items, item)
	}
	return items, total, rows.Err()
}

func (s *Service) Get(ctx context.Context, actor Principal, id string) (Detail, error) {
	if actor.Role != "operations" && actor.Role != "supervisor" {
		return Detail{}, ErrForbidden
	}
	var result Detail
	if err := scanSummary(s.db.QueryRow(ctx, summarySelect+` WHERE batch_id = $1`, id), &result.Summary); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return Detail{}, ErrNotFound
		}
		return Detail{}, err
	}
	issues, err := s.loadIssues(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	snapshots, err := s.loadSnapshots(ctx, id)
	if err != nil {
		return Detail{}, err
	}
	result.Issues = issues
	result.Snapshots = snapshots
	return result, nil
}

const summarySelect = `SELECT batch_id::text, batch_code, business_unit,
	period_start::text, period_end::text, business_cutoff_date::text,
	source_file_name, status, valid_count, rejected_count, degraded_count, warning_count,
	rule_version, failure_code, created_by, created_at, completed_at FROM import_batch`

type scanner interface {
	Scan(dest ...interface{}) error
}

func scanSummary(row scanner, target *Summary) error {
	return row.Scan(&target.ID, &target.Code, &target.BusinessUnit, &target.PeriodStart,
		&target.PeriodEnd, &target.CutoffDate, &target.FileName, &target.Status,
		&target.ValidCount, &target.RejectedCount, &target.DegradedCount, &target.WarningCount,
		&target.RuleVersion, &target.FailureCode, &target.CreatedBy, &target.CreatedAt, &target.CompletedAt)
}

func ValidatePeriod(start, end, cutoff time.Time) error {
	if start.Day() != 1 {
		return errors.New("period must start on first day of month")
	}
	expectedEnd := start.AddDate(0, 1, -1)
	if !sameDate(end, expectedEnd) {
		return errors.New("period must be a complete natural month")
	}
	if cutoff.Before(end) {
		return errors.New("business cutoff date must not precede period end")
	}
	return nil
}

func sameDate(left, right time.Time) bool {
	ly, lm, ld := left.Date()
	ry, rm, rd := right.Date()
	return ly == ry && lm == rm && ld == rd
}

func (s *Service) loadIssues(ctx context.Context, batchID string) ([]Issue, error) {
	rows, err := s.db.Query(ctx, `SELECT coalesce(source_sheet,''), source_row, spu_id, field_name,
		raw_value, error_code, reason, impact, resolution, severity
		FROM import_error WHERE batch_id = $1 ORDER BY severity, source_row NULLS FIRST, error_id`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Issue, 0)
	for rows.Next() {
		var item Issue
		if err := rows.Scan(&item.SourceSheet, &item.SourceRow, &item.SPUID, &item.Field, &item.RawValue,
			&item.Code, &item.Reason, &item.Impact, &item.Resolution, &item.Severity); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func (s *Service) loadSnapshots(ctx context.Context, batchID string) ([]Snapshot, error) {
	rows, err := s.db.Query(ctx, `SELECT s.snapshot_id::text, s.spu_id, s.spu_name, s.store, s.platform,
		s.operator_ref, s.source_sheet, s.source_row, s.launch_date::text,
		s.net_sales_prev_month::float8, s.operating_profit_rate::float8,
		s.quality_return_rate_7d::float8, s.inventory_days::float8, s.quality, s.raw_values,
		d.decision_id::text, d.product_type, d.business_action, d.inventory_action,
		d.trigger_rule, d.structured_evidence
		FROM spu_snapshot s LEFT JOIN decision_record d ON d.snapshot_id = s.snapshot_id
		WHERE s.batch_id = $1 ORDER BY s.source_row, s.snapshot_id`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Snapshot, 0)
	for rows.Next() {
		var item Snapshot
		var decisionID, productType, businessAction, inventoryAction *string
		var triggerRule *string
		var evidence []byte
		if err := rows.Scan(&item.ID, &item.SPUID, &item.Name, &item.Store, &item.Platform,
			&item.OperatorRef, &item.SourceSheet, &item.SourceRow, &item.LaunchDate,
			&item.NetSales, &item.ProfitRate, &item.QualityReturnRate, &item.InventoryDays,
			&item.qualityJSON, &item.rawJSON, &decisionID, &productType, &businessAction,
			&inventoryAction, &triggerRule, &evidence); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(item.qualityJSON, &item.Quality); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(item.rawJSON, &item.RawValues); err != nil {
			return nil, err
		}
		if decisionID != nil {
			decision := &Decision{ID: *decisionID, ProductType: productType, BusinessAction: businessAction, InventoryAction: inventoryAction}
			if triggerRule != nil {
				decision.TriggerRule = *triggerRule
			}
			if err := json.Unmarshal(evidence, &decision.Evidence); err != nil {
				return nil, err
			}
			item.Decision = decision
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
