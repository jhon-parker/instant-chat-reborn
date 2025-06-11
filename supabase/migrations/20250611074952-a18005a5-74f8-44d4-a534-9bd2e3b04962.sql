
-- Настраиваем политики для avatars (если корзина уже существует)
DO $$
BEGIN
    -- Проверяем и создаем политики для avatars если их нет
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Avatar images are publicly accessible'
    ) THEN
        CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
          FOR SELECT USING (bucket_id = 'avatars');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can upload their own avatar'
    ) THEN
        CREATE POLICY "Users can upload their own avatar" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their own avatar'
    ) THEN
        CREATE POLICY "Users can update their own avatar" ON storage.objects
          FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their own avatar'
    ) THEN
        CREATE POLICY "Users can delete their own avatar" ON storage.objects
          FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END $$;

-- Создаем корзину для файлов чата если её нет
INSERT INTO storage.buckets (id, name, public) 
SELECT 'chat-files', 'chat-files', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-files');

-- Настраиваем политики для chat-files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Chat files are publicly accessible'
    ) THEN
        CREATE POLICY "Chat files are publicly accessible" ON storage.objects
          FOR SELECT USING (bucket_id = 'chat-files');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can upload chat files'
    ) THEN
        CREATE POLICY "Authenticated users can upload chat files" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);
    END IF;
END $$;

-- Включаем реальное время для таблиц
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.chat_members REPLICA IDENTITY FULL;

-- Добавляем таблицы в публикацию для реального времени
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    EXCEPTION WHEN duplicate_object THEN
        -- Таблица уже добавлена
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chats;
    EXCEPTION WHEN duplicate_object THEN
        -- Таблица уже добавлена
    END;
    
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_members;
    EXCEPTION WHEN duplicate_object THEN
        -- Таблица уже добавлена
    END;
END $$;

-- Создаем функцию для поиска или создания персонального чата
CREATE OR REPLACE FUNCTION find_or_create_personal_chat(other_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    existing_chat_id UUID;
    new_chat_id UUID;
    other_user_profile RECORD;
BEGIN
    -- Проверяем существующий персональный чат между двумя пользователями
    SELECT cm1.chat_id INTO existing_chat_id
    FROM chat_members cm1
    JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
    JOIN chats c ON cm1.chat_id = c.id
    WHERE cm1.user_id = auth.uid()
    AND cm2.user_id = other_user_id
    AND c.chat_type = 'personal'
    AND c.is_group = false;

    -- Если чат существует, возвращаем его ID
    IF existing_chat_id IS NOT NULL THEN
        RETURN existing_chat_id;
    END IF;

    -- Получаем данные другого пользователя для названия чата
    SELECT first_name, last_name, username, avatar_url 
    INTO other_user_profile
    FROM profiles 
    WHERE id = other_user_id;

    -- Создаем новый персональный чат
    INSERT INTO chats (name, chat_type, is_group, created_by, avatar_url)
    VALUES (
        COALESCE(
            TRIM(CONCAT(other_user_profile.first_name, ' ', other_user_profile.last_name)), 
            other_user_profile.username, 
            'Чат'
        ),
        'personal',
        false,
        auth.uid(),
        other_user_profile.avatar_url
    ) RETURNING id INTO new_chat_id;

    -- Добавляем обоих пользователей в чат
    INSERT INTO chat_members (chat_id, user_id, role) VALUES
        (new_chat_id, auth.uid(), 'admin'),
        (new_chat_id, other_user_id, 'member');

    RETURN new_chat_id;
END;
$$;
