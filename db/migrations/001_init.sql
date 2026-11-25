-- Pace of Play Ratings: initial schema.
-- Every table is scoped to a club. The club is the data controller; this app is its processor.

create extension if not exists pgcrypto;

create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/London',
  invite_delay_hours int not null default 5,
  invite_channel text not null default 'email' check (invite_channel in ('sms','email')),
  min_votes int not null default 5,
  window_months int not null default 3,
  api_key_hash text,
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  external_id text,               -- the member number in the club's booking system
  name text not null,
  email text,
  phone text,                     -- E.164, e.g. +447700900123
  handicap text,
  role text not null default 'member' check (role in ('member','secretary')),
  opted_out boolean not null default false,   -- no more rating messages
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (club_id, external_id)
);
create index members_club_idx on members(club_id);
create index members_email_idx on members(lower(email));

create table rounds (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  external_id text,
  tee_time timestamptz not null,
  course text,
  invites_due_at timestamptz not null,
  invites_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (club_id, external_id)
);
create index rounds_due_idx on rounds(invites_due_at) where invites_sent_at is null;

create table round_players (
  round_id uuid not null references rounds(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  primary key (round_id, member_id)
);
create index round_players_member_idx on round_players(member_id);

create table invites (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  token_hash text not null unique,
  channel text,
  sent_at timestamptz,
  send_error text,
  opened_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz not null,
  unique (round_id, member_id)
);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  round_id uuid not null references rounds(id) on delete cascade,
  rater_id uuid not null references members(id) on delete cascade,
  ratee_id uuid not null references members(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  reasons text[] not null default '{}',
  note text,
  -- counted: 3-5 stars, counts straight away. pending: 1-2 stars waiting for the secretary.
  -- accepted: low rating the secretary agreed with. dismissed: removed, never counts.
  status text not null check (status in ('counted','pending','accepted','dismissed')),
  reviewed_by uuid references members(id) on delete set null,
  reviewed_at timestamptz,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (round_id, rater_id, ratee_id),
  check (rater_id <> ratee_id)
);
create index ratings_ratee_idx on ratings(ratee_id);
create index ratings_rater_idx on ratings(rater_id);
create index ratings_pending_idx on ratings(club_id) where status = 'pending';

-- A monthly release. Members only ever see released numbers, so a rating can't be traced to one round.
create table releases (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  period date not null,           -- first day of the month being released, e.g. 2026-11-01 is released on 1 Dec
  released_at timestamptz not null default now(),
  unique (club_id, period)
);

create table member_scores (
  release_id uuid not null references releases(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  votes int not null,             -- ratings in the rolling window
  average numeric(3,2),           -- null when votes < the club's minimum
  month_votes int not null,
  month_average numeric(3,2),     -- null when month_votes < the club's minimum
  primary key (release_id, member_id)
);

create table login_tokens (
  token_hash text primary key,
  member_id uuid not null references members(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz
);

create table sessions (
  token_hash text primary key,
  member_id uuid not null references members(id) on delete cascade,
  expires_at timestamptz not null
);

create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now());

-- Supabase exposes the public schema through its web API. This app never uses that API:
-- it connects directly with DATABASE_URL. Turning on row level security with no policies
-- means nothing can be read or written through the public API keys.
alter table clubs enable row level security;
alter table members enable row level security;
alter table rounds enable row level security;
alter table round_players enable row level security;
alter table invites enable row level security;
alter table ratings enable row level security;
alter table releases enable row level security;
alter table member_scores enable row level security;
alter table login_tokens enable row level security;
alter table sessions enable row level security;
alter table schema_migrations enable row level security;

-- Records this file as applied, so it also works when pasted into Supabase's SQL editor.
insert into schema_migrations (name) values ('001_init.sql') on conflict do nothing;
