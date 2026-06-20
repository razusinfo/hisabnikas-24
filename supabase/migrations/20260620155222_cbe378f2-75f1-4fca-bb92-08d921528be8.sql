
-- Revoke EXECUTE from PUBLIC and anon on all SECURITY DEFINER functions, grant to authenticated where needed

-- Trigger-only functions: revoke from everyone (triggers run as owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_customer_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock_on_sale() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_stock_on_purchase() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_payment_request() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: revoke from anon, allow authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_plan_spec(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plan_spec(text, text) TO authenticated;

-- User-callable RPCs: authenticated only
REVOKE EXECUTE ON FUNCTION public.activate_free_plan() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_free_plan() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.activate_plan(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_plan(text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.consume_sms_credit(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_sms_credit(uuid, text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.send_due_reminder_sms(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_due_reminder_sms(uuid, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_all_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_all_subscriptions() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.list_all_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_all_users() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.revoke_subscription(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_subscription(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.approve_payment_request(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_payment_request(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reject_payment_request(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.refund_sms_credit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refund_sms_credit(uuid) TO authenticated;
