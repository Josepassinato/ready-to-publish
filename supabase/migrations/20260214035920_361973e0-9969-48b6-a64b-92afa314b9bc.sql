
-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Table to store channel integration configs per user
CREATE TABLE public.channel_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('telegram', 'whatsapp')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  webhook_registered BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_type)
);

ALTER TABLE public.channel_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own channel configs"
ON public.channel_configs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own channel configs"
ON public.channel_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own channel configs"
ON public.channel_configs FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own channel configs"
ON public.channel_configs FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_channel_configs_updated_at
BEFORE UPDATE ON public.channel_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
