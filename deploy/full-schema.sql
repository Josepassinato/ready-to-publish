-- ============================================
-- SCRIPT COMPLETO - ESTRUTURA DO BANCO DE DADOS
-- Projeto: Governance Decision Engine
-- Gerado em: 2026-02-27
-- ============================================

-- 1. TABELA: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY,
  name text,
  company text,
  role text DEFAULT 'leader',
  onboarding_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. TABELA: decisions
CREATE TABLE IF NOT EXISTS public.decisions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  pipeline_id text NOT NULL,
  description text NOT NULL,
  decision_type text NOT NULL,
  impact text NOT NULL,
  reversibility text NOT NULL,
  urgency text NOT NULL,
  resources_required text,
  verdict text NOT NULL,
  overall_score smallint NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  state_id text NOT NULL,
  state_severity smallint NOT NULL,
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
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own decisions" ON public.decisions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own decisions" ON public.decisions FOR SELECT USING (auth.uid() = user_id);

-- 3. TABELA: readiness_plans
CREATE TABLE IF NOT EXISTS public.readiness_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  decision_id uuid NOT NULL REFERENCES public.decisions(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  structural_reason text NOT NULL,
  primary_bottleneck jsonb NOT NULL,
  secondary_bottleneck jsonb,
  actions jsonb NOT NULL,
  reevaluation_triggers jsonb NOT NULL,
  timeline text,
  actions_total smallint NOT NULL,
  actions_completed smallint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  reevaluated boolean NOT NULL DEFAULT false,
  reevaluated_at timestamptz,
  reevaluation_verdict text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.readiness_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own plans" ON public.readiness_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own plans" ON public.readiness_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.readiness_plans FOR UPDATE USING (auth.uid() = user_id);

-- 4. TABELA: plan_actions
CREATE TABLE IF NOT EXISTS public.plan_actions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id uuid NOT NULL REFERENCES public.readiness_plans(id),
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  action_text text NOT NULL,
  action_index smallint NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.plan_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own actions" ON public.plan_actions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own actions" ON public.plan_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own actions" ON public.plan_actions FOR UPDATE USING (auth.uid() = user_id);

-- 5. TABELA: state_classifications
CREATE TABLE IF NOT EXISTS public.state_classifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  energy smallint NOT NULL,
  clarity smallint NOT NULL,
  stress smallint NOT NULL,
  confidence smallint NOT NULL,
  load smallint NOT NULL,
  overall_score smallint NOT NULL,
  state_id text NOT NULL,
  state_label text NOT NULL,
  state_severity smallint NOT NULL,
  classification_confidence numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.state_classifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own classifications" ON public.state_classifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own classifications" ON public.state_classifications FOR SELECT USING (auth.uid() = user_id);

-- 6. TABELA: chat_messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  role text NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own messages" ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);

-- 7. TABELA: user_memory
CREATE TABLE IF NOT EXISTS public.user_memory (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  category text NOT NULL,
  key text NOT NULL,
  value text NOT NULL,
  confidence numeric DEFAULT 1.0,
  source text DEFAULT 'onboarding',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own memory" ON public.user_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own memory" ON public.user_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own memory" ON public.user_memory FOR UPDATE USING (auth.uid() = user_id);

-- 8. TABELA: feature_flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  flag_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own flags" ON public.feature_flags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own flags" ON public.feature_flags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own flags" ON public.feature_flags FOR UPDATE USING (auth.uid() = user_id);

-- 9. TABELA: governance_audit_log
CREATE TABLE IF NOT EXISTS public.governance_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pipeline_id text NOT NULL,
  event_type text NOT NULL,
  constitution_version text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.governance_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own audit logs" ON public.governance_audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own audit logs" ON public.governance_audit_log FOR SELECT USING (auth.uid() = user_id);

-- 10. TABELA: channel_configs
CREATE TABLE IF NOT EXISTS public.channel_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  channel_type text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  webhook_registered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own channel configs" ON public.channel_configs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own channel configs" ON public.channel_configs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own channel configs" ON public.channel_configs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own channel configs" ON public.channel_configs FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (new.id, new.raw_user_meta_data->>'name');
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Capacity trend function
CREATE OR REPLACE FUNCTION public.get_capacity_trend(p_user_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(created_at timestamptz, overall_score smallint, state_id text, classification_confidence numeric)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT sc.created_at, sc.overall_score, sc.state_id, sc.classification_confidence
  FROM public.state_classifications sc
  WHERE sc.user_id = p_user_id
  ORDER BY sc.created_at DESC
  LIMIT p_limit;
$$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- VIEW: dashboard stats
-- ============================================
CREATE OR REPLACE VIEW public.v_dashboard_stats AS
SELECT
  user_id,
  count(*) AS total_decisions,
  count(*) FILTER (WHERE verdict = 'SIM') AS total_sim,
  count(*) FILTER (WHERE verdict = 'NÃO AGORA') AS total_nao_agora,
  round(avg(overall_score), 1) AS avg_score,
  max(created_at) AS last_decision_at
FROM public.decisions
GROUP BY user_id;
