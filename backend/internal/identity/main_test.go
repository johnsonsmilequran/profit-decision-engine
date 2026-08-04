package identity

import (
	"os"
	"testing"

	"github.com/johnsonsmilequran/profit-decision-engine/backend/internal/testsupport"
)

func TestMain(m *testing.M) {
	os.Exit(testsupport.RunWithDatabasePackageLock(m))
}
