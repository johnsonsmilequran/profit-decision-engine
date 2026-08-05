package testsupport

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
)

const sharedTestDatabaseLockID int64 = 7_026_086_683_283_219_791

// RunWithDatabasePackageLock serializes packages that share TEST_DATABASE_URL.
// Package-local tests and their race detection still run normally while the lock is held.
func RunWithDatabasePackageLock(m *testing.M) int {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		return m.Run()
	}

	lockContext, cancelLock := context.WithTimeout(context.Background(), 60*time.Second)
	connection, err := pgx.Connect(lockContext, databaseURL)
	if err != nil {
		cancelLock()
		fmt.Fprintf(os.Stderr, "共享测试数据库锁连接失败: %v\n", err)
		return 1
	}
	defer connection.Close(context.Background())

	if _, err := connection.Exec(lockContext, "SELECT pg_advisory_lock($1)", sharedTestDatabaseLockID); err != nil {
		cancelLock()
		fmt.Fprintf(os.Stderr, "共享测试数据库锁获取失败: %v\n", err)
		return 1
	}
	cancelLock()

	exitCode := m.Run()

	unlockContext, cancelUnlock := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancelUnlock()
	if _, err := connection.Exec(unlockContext, "SELECT pg_advisory_unlock($1)", sharedTestDatabaseLockID); err != nil {
		fmt.Fprintf(os.Stderr, "共享测试数据库锁释放失败: %v\n", err)
		if exitCode == 0 {
			return 1
		}
	}

	return exitCode
}
