-- +goose Up
ALTER TABLE role_mapping ADD COLUMN dingtalk_user_id text;
ALTER TABLE role_mapping ADD CONSTRAINT role_mapping_dingtalk_user_id_nonblank
    CHECK (dingtalk_user_id IS NULL OR btrim(dingtalk_user_id) <> '');
CREATE UNIQUE INDEX role_mapping_active_dingtalk_user_id_idx
    ON role_mapping(dingtalk_user_id) WHERE active AND dingtalk_user_id IS NOT NULL;

-- +goose Down
DROP INDEX role_mapping_active_dingtalk_user_id_idx;
ALTER TABLE role_mapping DROP CONSTRAINT role_mapping_dingtalk_user_id_nonblank;
ALTER TABLE role_mapping DROP COLUMN dingtalk_user_id;
