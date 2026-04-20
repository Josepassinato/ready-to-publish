-- Wave B: align user_memory and chat_messages FKs with the other 7 user_id FKs.
-- Before: ON DELETE NO ACTION (blocks DELETE FROM users).
-- After:  ON DELETE CASCADE (consistent with decisions, readiness_plans,
-- plan_actions, state_classifications, user_assessments, telegram_users,
-- whatsapp_users).

BEGIN;

ALTER TABLE user_memory DROP CONSTRAINT user_memory_user_id_fkey;
ALTER TABLE user_memory
    ADD CONSTRAINT user_memory_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE chat_messages DROP CONSTRAINT chat_messages_user_id_fkey;
ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

COMMIT;
