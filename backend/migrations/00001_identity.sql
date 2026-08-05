-- +goose Up
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE business_role AS ENUM ('operations', 'supervisor');

CREATE TABLE role_mapping (
    actor_ref text PRIMARY KEY,
    display_name text NOT NULL CHECK (display_name <> ''),
    role business_role NOT NULL,
    active boolean NOT NULL DEFAULT true,
    approved_by text NOT NULL CHECK (approved_by <> ''),
    configured_by text NOT NULL CHECK (configured_by <> ''),
    configured_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_session (
    session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_digest bytea NOT NULL UNIQUE,
    actor_ref text NOT NULL REFERENCES role_mapping(actor_ref),
    role business_role NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    absolute_expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (absolute_expires_at > created_at)
);

CREATE INDEX user_session_actor_active_idx ON user_session(actor_ref, absolute_expires_at) WHERE revoked_at IS NULL;

-- +goose Down
DROP TABLE user_session;
DROP TABLE role_mapping;
DROP TYPE business_role;
