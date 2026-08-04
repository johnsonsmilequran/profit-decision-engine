alter table action_items add column execution_result text;
alter table action_items add column result_recorded_by text references role_mappings(identity_ref);
