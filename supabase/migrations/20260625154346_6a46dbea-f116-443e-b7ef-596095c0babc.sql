CREATE OR REPLACE FUNCTION public.get_plan_spec(_kind text, _plan text)
 RETURNS TABLE(amount numeric, duration_days integer, messages_count integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT t.amount, t.duration_days, t.messages_count
  FROM (VALUES
    ('subscription','basic_30',  399::numeric,  30::int,  NULL::int),
    ('subscription','pro_30',    699::numeric,  30::int,  NULL::int),
    ('subscription','basic_365', 1499::numeric, 365::int, NULL::int),
    ('subscription','pro_365',   1999::numeric, 365::int, NULL::int),
    ('messages','msg_30',   20::numeric,   NULL::int, 30::int),
    ('messages','msg_50',   31::numeric,   NULL::int, 50::int),
    ('messages','msg_100',  55::numeric,   NULL::int, 100::int),
    ('messages','msg_250',  125::numeric,  NULL::int, 250::int),
    ('messages','msg_500',  225::numeric,  NULL::int, 500::int),
    ('messages','msg_1000', 400::numeric,  NULL::int, 1000::int),
    ('messages','msg_5000', 1750::numeric, NULL::int, 5000::int)
  ) AS t(kind, plan, amount, duration_days, messages_count)
  WHERE t.kind = _kind AND t.plan = _plan;
$function$;