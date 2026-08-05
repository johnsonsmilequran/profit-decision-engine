-- +goose Up
ALTER TABLE oa_notification
    ADD COLUMN message_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0);

-- +goose Down
ALTER TABLE oa_notification DROP COLUMN attempt_count;
ALTER TABLE oa_notification DROP COLUMN message_payload;
