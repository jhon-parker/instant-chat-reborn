
-- Добавляем типы чатов
CREATE TYPE chat_type AS ENUM ('personal', 'group', 'channel');

-- Обновляем таблицу chats
ALTER TABLE public.chats 
ADD COLUMN chat_type chat_type DEFAULT 'personal',
ADD COLUMN is_pinned boolean DEFAULT false,
ADD COLUMN is_archived boolean DEFAULT false,
ADD COLUMN is_muted boolean DEFAULT false,
ADD COLUMN member_count integer DEFAULT 0,
ADD COLUMN invite_link text,
ADD COLUMN settings jsonb DEFAULT '{}';

-- Добавляем настройки приватности в profiles
ALTER TABLE public.profiles 
ADD COLUMN privacy_settings jsonb DEFAULT '{
  "show_phone": "everyone",
  "show_last_seen": "everyone", 
  "show_profile_photo": "everyone",
  "allow_calls": "everyone",
  "allow_groups": "everyone"
}',
ADD COLUMN notification_settings jsonb DEFAULT '{
  "sound": true,
  "vibration": true,
  "preview": true,
  "group_notifications": true
}';

-- Создаем таблицу уведомлений
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL, -- 'message', 'mention', 'group_invite', etc.
  title text NOT NULL,
  body text,
  data jsonb DEFAULT '{}',
  is_read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Создаем чат "Избранное" для всех пользователей
CREATE OR REPLACE FUNCTION create_saved_messages_chat()
RETURNS trigger AS $$
BEGIN
  -- Создаем чат "Избранное"
  INSERT INTO public.chats (id, name, chat_type, created_by, description)
  VALUES (
    gen_random_uuid(),
    'Избранное',
    'personal',
    NEW.id,
    'Сохраняйте здесь важные сообщения'
  );
  
  -- Добавляем пользователя как участника
  INSERT INTO public.chat_members (chat_id, user_id, role)
  SELECT id, NEW.id, 'admin'
  FROM public.chats 
  WHERE created_by = NEW.id AND name = 'Избранное';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Создаем триггер для автоматического создания чата "Избранное"
CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION create_saved_messages_chat();

-- Обновляем chat_members для поддержки дополнительных ролей
ALTER TABLE public.chat_members 
ADD COLUMN can_send_messages boolean DEFAULT true,
ADD COLUMN can_add_members boolean DEFAULT false,
ADD COLUMN can_pin_messages boolean DEFAULT false,
ADD COLUMN can_delete_messages boolean DEFAULT false;

-- RLS для уведомлений
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Обновляем политики для новых полей
DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.chats;

CREATE POLICY "Users can view chats they are members of" ON public.chats
  FOR SELECT USING (
    chat_type = 'channel' OR
    EXISTS (
      SELECT 1 FROM public.chat_members 
      WHERE chat_id = chats.id AND user_id = auth.uid()
    )
  );

-- Включаем realtime для уведомлений
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
