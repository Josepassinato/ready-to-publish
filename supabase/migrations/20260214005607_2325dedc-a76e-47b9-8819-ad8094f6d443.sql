
-- ── Profiles (extends auth.users) ────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  company text,
  role text default 'leader',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── State Classifications ────────────────────────────────────────

create table public.state_classifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  energy smallint not null,
  clarity smallint not null,
  stress smallint not null,
  confidence smallint not null,
  load smallint not null,
  overall_score smallint not null,
  state_id text not null,
  state_label text not null,
  state_severity smallint not null,
  classification_confidence numeric(3,2) not null,
  created_at timestamptz default now()
);

alter table public.state_classifications enable row level security;

create policy "Users can read own classifications"
  on public.state_classifications for select using (auth.uid() = user_id);

create policy "Users can insert own classifications"
  on public.state_classifications for insert with check (auth.uid() = user_id);

create index idx_state_user on public.state_classifications(user_id, created_at desc);

-- ── Decisions ─────────────────────────────────────────────────────

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pipeline_id text not null unique,
  description text not null,
  decision_type text not null,
  impact text not null,
  reversibility text not null,
  urgency text not null,
  resources_required text,
  verdict text not null,
  overall_score smallint not null,
  blocked boolean not null default false,
  state_id text not null,
  state_severity smallint not null,
  human_score smallint,
  business_score smallint,
  financial_score smallint,
  relational_score smallint,
  domain_financial smallint,
  domain_emotional smallint,
  domain_decisional smallint,
  domain_operational smallint,
  domain_relational smallint,
  domain_energetic smallint,
  full_result jsonb,
  guidance_text text,
  created_at timestamptz default now()
);

alter table public.decisions enable row level security;

create policy "Users can read own decisions"
  on public.decisions for select using (auth.uid() = user_id);

create policy "Users can insert own decisions"
  on public.decisions for insert with check (auth.uid() = user_id);

create index idx_decisions_user on public.decisions(user_id, created_at desc);
create index idx_decisions_verdict on public.decisions(verdict);

-- ── Readiness Plans ──────────────────────────────────────────────

create table public.readiness_plans (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  structural_reason text not null,
  primary_bottleneck jsonb not null,
  secondary_bottleneck jsonb,
  actions jsonb not null,
  reevaluation_triggers jsonb not null,
  timeline text,
  status text not null default 'active',
  actions_completed smallint not null default 0,
  actions_total smallint not null,
  reevaluated boolean not null default false,
  reevaluation_verdict text,
  reevaluated_at timestamptz,
  created_at timestamptz default now()
);

alter table public.readiness_plans enable row level security;

create policy "Users can read own plans"
  on public.readiness_plans for select using (auth.uid() = user_id);

create policy "Users can insert own plans"
  on public.readiness_plans for insert with check (auth.uid() = user_id);

create policy "Users can update own plans"
  on public.readiness_plans for update using (auth.uid() = user_id);

create index idx_plans_user on public.readiness_plans(user_id, status);

-- ── Plan Action Tracking ─────────────────────────────────────────

create table public.plan_actions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.readiness_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  action_index smallint not null,
  action_text text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.plan_actions enable row level security;

create policy "Users can read own actions"
  on public.plan_actions for select using (auth.uid() = user_id);

create policy "Users can insert own actions"
  on public.plan_actions for insert with check (auth.uid() = user_id);

create policy "Users can update own actions"
  on public.plan_actions for update using (auth.uid() = user_id);

-- ── Dashboard view ───────────────────────────────────────────────

create view public.v_dashboard_stats with (security_invoker=on) as
select
  user_id,
  count(*) as total_decisions,
  count(*) filter (where verdict = 'SIM') as total_sim,
  count(*) filter (where verdict = 'NÃO AGORA') as total_nao_agora,
  round(avg(overall_score)) as avg_score,
  max(created_at) as last_decision_at
from public.decisions
group by user_id;

-- ── Capacity trend function ──────────────────────────────────────

create or replace function public.get_capacity_trend(p_user_id uuid, p_limit int default 10)
returns table (
  created_at timestamptz,
  overall_score smallint,
  state_id text,
  classification_confidence numeric
) as $$
  select created_at, overall_score, state_id, classification_confidence
  from public.state_classifications
  where user_id = p_user_id
  order by created_at desc
  limit p_limit;
$$ language sql security definer;
