
-- ═══════════════════════════════════════════════════════════════
-- AUDIT LOGGER: Tabela append-only para registro de eventos do pipeline
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.governance_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'intake' | 'state_classification' | 'layer_analysis' | 'threshold_check' | 'scenario_simulation' | 'verdict' | 'readiness_plan'
  event_data JSONB NOT NULL DEFAULT '{}',
  constitution_version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para consulta eficiente
CREATE INDEX idx_audit_log_user_id ON public.governance_audit_log(user_id);
CREATE INDEX idx_audit_log_pipeline_id ON public.governance_audit_log(pipeline_id);
CREATE INDEX idx_audit_log_created_at ON public.governance_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_event_type ON public.governance_audit_log(event_type);

-- Enable RLS
ALTER TABLE public.governance_audit_log ENABLE ROW LEVEL SECURITY;

-- Usuários podem VER seus próprios logs
CREATE POLICY "Users can view their own audit logs"
ON public.governance_audit_log FOR SELECT
USING (auth.uid() = user_id);

-- Usuários podem INSERIR seus próprios logs
CREATE POLICY "Users can insert their own audit logs"
ON public.governance_audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- NINGUÉM pode atualizar ou deletar logs (append-only)
-- Não criar policies de UPDATE/DELETE = bloqueio implícito pelo RLS

-- ═══════════════════════════════════════════════════════════════
-- FEATURE FLAGS: Tabela para kill-switch e outras flags
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, flag_name)
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own flags"
ON public.feature_flags FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own flags"
ON public.feature_flags FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own flags"
ON public.feature_flags FOR UPDATE
USING (auth.uid() = user_id);
