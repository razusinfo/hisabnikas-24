
REVOKE EXECUTE ON FUNCTION public.activate_free_plan() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.activate_plan(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.approve_payment_request(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.activate_free_plan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_plan(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
