create table oauth_states (
  state_hash text primary key,
  return_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  check (left(return_to, 1) = '/' and left(return_to, 2) <> '//')
);

create index oauth_states_expires_at_idx on oauth_states(expires_at);
