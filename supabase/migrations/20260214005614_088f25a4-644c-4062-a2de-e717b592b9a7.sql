
-- Fix search_path on functions
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.get_capacity_trend(p_user_id uuid, p_limit int default 10)
returns table (
  created_at timestamptz,
  overall_score smallint,
  state_id text,
  classification_confidence numeric
) as $$
  select sc.created_at, sc.overall_score, sc.state_id, sc.classification_confidence
  from public.state_classifications sc
  where sc.user_id = p_user_id
  order by sc.created_at desc
  limit p_limit;
$$ language sql security definer set search_path = public;
