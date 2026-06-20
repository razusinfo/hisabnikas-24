-- Restrict Realtime channel subscriptions: authenticated users may only
-- subscribe to topics that contain their own auth uid. This prevents one
-- user from listening to another user's subscription-status channel.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only subscribe to own topics" ON realtime.messages;
CREATE POLICY "Users can only subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE '%' || auth.uid()::text || '%'
);