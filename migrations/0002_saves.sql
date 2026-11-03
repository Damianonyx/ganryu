create table if not exists player_saves (
  user_id text primary key,
  fighter_id text not null default 'kage',
  max_level integer not null default 1,
  current_level integer not null default 1,
  wins integer not null default 0,
  losses integer not null default 0,
  updated_at timestamptz not null default now()
);
create index if not exists player_saves_user_id_idx on player_saves (user_id);
