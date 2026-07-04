create table if not exists workspaces (
  id text primary key,
  name text not null,
  profile text not null default 'tattoo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table workspaces
  add column if not exists profile text not null default 'tattoo';

create table if not exists app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_users
  add column if not exists password_hash text;

create table if not exists workspace_members (
  workspace_id text not null references workspaces(id) on delete cascade,
  user_id text not null references app_users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists sessions (
  token text primary key,
  user_id text not null references app_users(id) on delete cascade,
  workspace_id text references workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create index if not exists sessions_user_idx on sessions(user_id);
create index if not exists sessions_expires_idx on sessions(expires_at);

create table if not exists ai_usage_log (
  id bigserial primary key,
  workspace_id text not null,
  user_id text not null,
  model text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_log_workspace_created_idx
  on ai_usage_log(workspace_id, created_at desc);

create table if not exists workspace_settings (
  workspace_id text primary key references workspaces(id) on delete cascade,
  business_profile text not null default 'tattoo',
  tone_profile text not null default 'warm',
  response_window text not null default 'fast',
  channels text[] not null default '{}',
  intake_fields text[] not null default '{}',
  welcome_message text not null default '',
  onboarding_completed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table workspace_settings
  add column if not exists channels text[] not null default '{}',
  add column if not exists intake_fields text[] not null default '{}',
  add column if not exists welcome_message text not null default '',
  add column if not exists onboarding_completed_at timestamptz;

create table if not exists customers (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  normalized_key text,
  name text not null,
  channel text not null default '미확인',
  contact text,
  status text not null default 'new',
  tags text[] not null default '{}',
  note text not null default '',
  skin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table customers
  add column if not exists normalized_key text,
  add column if not exists status text not null default 'new',
  add column if not exists tags text[] not null default '{}',
  add column if not exists note text not null default '',
  add column if not exists skin_notes text;

create index if not exists customers_workspace_name_idx
  on customers(workspace_id, name);

create unique index if not exists customers_workspace_normalized_key_idx
  on customers(workspace_id, normalized_key);

create table if not exists inquiries (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  customer_id text references customers(id) on delete set null,
  customer_name text not null,
  channel text not null default '미확인',
  message text not null,
  category text not null,
  priority text not null,
  keywords text[] not null default '{}',
  reply text not null,
  status text not null default 'new',
  profile text not null default 'tattoo',
  tone text not null default 'warm',
  response_window text not null default 'fast',
  ai_generated_at timestamptz,
  ai_model text,
  ai_draft text,
  ai_quality jsonb not null default '{}'::jsonb,
  reply_revision_log jsonb not null default '[]'::jsonb,
  assignee_id text,
  internal_note text not null default '',
  timeline jsonb not null default '[]'::jsonb,
  tattoo_area text,
  tattoo_size text,
  tattoo_style text,
  is_coverup boolean not null default false,
  session_count integer,
  quoted_price text,
  preferred_date text,
  has_reference_image boolean not null default false,
  reference_image_note text,
  deposit_amount text,
  deposit_payer_name text,
  deposit_paid_at timestamptz,
  appointment_at text,
  policy_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inquiries
  add column if not exists ai_draft text,
  add column if not exists ai_quality jsonb not null default '{}'::jsonb,
  add column if not exists reply_revision_log jsonb not null default '[]'::jsonb,
  add column if not exists assignee_id text,
  add column if not exists internal_note text not null default '',
  add column if not exists timeline jsonb not null default '[]'::jsonb,
  add column if not exists tattoo_area text,
  add column if not exists tattoo_size text,
  add column if not exists tattoo_style text,
  add column if not exists is_coverup boolean not null default false,
  add column if not exists session_count integer,
  add column if not exists quoted_price text,
  add column if not exists preferred_date text,
  add column if not exists has_reference_image boolean not null default false,
  add column if not exists reference_image_note text,
  add column if not exists deposit_amount text,
  add column if not exists deposit_payer_name text,
  add column if not exists deposit_paid_at timestamptz,
  add column if not exists appointment_at text,
  add column if not exists policy_confirmed boolean not null default false;

-- 상태값을 타투 예약 전환 파이프라인으로 마이그레이션 (구 범용 CS 상태 → 신규 상태)
update inquiries set status = 'quoted' where status = 'drafted';
update inquiries set status = 'info_requested' where status = 'pending';
update inquiries set status = 'deposit_pending' where status = 'escalated';
update inquiries set status = 'closed' where status = 'done';

create index if not exists inquiries_workspace_created_idx
  on inquiries(workspace_id, created_at desc);

create index if not exists inquiries_workspace_status_idx
  on inquiries(workspace_id, status);

create table if not exists business_knowledge (
  workspace_id text not null references workspaces(id) on delete cascade,
  profile text not null,
  prices text not null default '',
  faq text not null default '',
  updated_at timestamptz not null default now(),
  primary key (workspace_id, profile)
);

-- 범용 CRM 시절 데이터 마이그레이션: InkDesk는 타투 전용이므로 모든 프로필을 tattoo로 통일.
-- 레거시 업종(repair/academy/beauty/studio) 값이 남아 있으면 프런트가 프로필 조회에서 크래시한다.
update workspaces set profile = 'tattoo', updated_at = now() where profile <> 'tattoo';
update workspace_settings set business_profile = 'tattoo', updated_at = now() where business_profile <> 'tattoo';
update inquiries set profile = 'tattoo', updated_at = now() where profile <> 'tattoo';
delete from business_knowledge where profile <> 'tattoo';

insert into app_users (id, name, email)
values
  ('demo-owner', '원장님', 'owner@example.local'),
  ('demo-member', '상담 팀원', 'member@example.local')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  updated_at = now();

insert into workspaces (id, name, profile)
values
  ('default-workspace', '타투 스튜디오 데모', 'tattoo')
on conflict (id) do update set
  name = excluded.name,
  profile = excluded.profile,
  updated_at = now();

insert into workspace_members (workspace_id, user_id, role)
values
  ('default-workspace', 'demo-owner', 'owner'),
  ('default-workspace', 'demo-member', 'member')
on conflict (workspace_id, user_id) do update set
  role = excluded.role;

insert into workspace_settings (workspace_id, business_profile, tone_profile, response_window)
values
  ('default-workspace', 'tattoo', 'warm', 'fast')
on conflict (workspace_id) do nothing;
