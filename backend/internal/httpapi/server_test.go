package httpapi

import "testing"

func TestSafeReturn(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "workbench", raw: "/workbench/operations?batch=BATCH-1", want: "/workbench/operations?batch=BATCH-1"},
		{name: "absolute URL", raw: "https://attacker.example/path", want: "/"},
		{name: "protocol relative", raw: "//attacker.example/path", want: "/"},
		{name: "oauth callback", raw: "/auth/dingtalk/callback", want: "/"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := safeReturn(test.raw); got != test.want {
				t.Fatalf("safeReturn(%q)=%q, want %q", test.raw, got, test.want)
			}
		})
	}
}
