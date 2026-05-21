create table if not exists public.robot_groups (
  id text primary key,
  code text unique not null,
  name text not null,
  teacher_name text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.robot_profiles (
  id text primary key,
  auth_user_id uuid references auth.users(id) on delete set null,
  login text unique not null,
  name text not null,
  role text not null check (role in ('user', 'admin', 'moderator')),
  group_id text references public.robot_groups(id) on delete set null,
  exp integer not null default 0,
  completed_count integer not null default 0,
  teacher_confirm_code text,
  active boolean not null default true,
  active_until timestamptz,
  last_completed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.robot_collections (
  id text primary key,
  group_id text references public.robot_groups(id) on delete cascade,
  name text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.robot_instructions (
  id text primary key,
  group_id text references public.robot_groups(id) on delete cascade,
  collection_id text references public.robot_collections(id) on delete set null,
  title text not null,
  category text,
  difficulty text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.robot_instruction_results (
  user_id text references public.robot_profiles(id) on delete cascade,
  instruction_id text references public.robot_instructions(id) on delete cascade,
  earned_exp integer not null default 0,
  completed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, instruction_id)
);

create index if not exists robot_profiles_group_id_idx on public.robot_profiles(group_id);
create index if not exists robot_profiles_role_idx on public.robot_profiles(role);
create index if not exists robot_instructions_group_id_idx on public.robot_instructions(group_id);
create index if not exists robot_instructions_collection_id_idx on public.robot_instructions(collection_id);
create index if not exists robot_instruction_results_user_id_idx on public.robot_instruction_results(user_id);
create index if not exists robot_instruction_results_instruction_id_idx on public.robot_instruction_results(instruction_id);

alter table public.robot_groups enable row level security;
alter table public.robot_profiles enable row level security;
alter table public.robot_collections enable row level security;
alter table public.robot_instructions enable row level security;
alter table public.robot_instruction_results enable row level security;
