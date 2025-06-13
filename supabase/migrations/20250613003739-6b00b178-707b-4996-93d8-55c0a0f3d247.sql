
-- Создаем storage buckets если они не существуют
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
SELECT 'avatars', 'avatars', true, 52428800, ARRAY['image/*']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
SELECT 'chat-files', 'chat-files', true, 104857600, ARRAY['image/*', 'video/*', 'audio/*', 'application/*', 'text/*']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-files');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
SELECT 'chat-wallpapers', 'chat-wallpapers', true, 52428800, ARRAY['image/*']
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-wallpapers');

-- Удаляем старые политики если существуют
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Chat files are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Chat wallpapers are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload wallpapers" ON storage.objects;

-- Создаем правильные политики для storage
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upload to avatars" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update avatars" ON storage.objects 
FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete avatars" ON storage.objects 
FOR DELETE USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can upload chat files" ON storage.objects 
FOR INSERT WITH CHECK (bucket_id IN ('chat-files', 'chat-wallpapers') AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update chat files" ON storage.objects 
FOR UPDATE USING (bucket_id IN ('chat-files', 'chat-wallpapers') AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete chat files" ON storage.objects 
FOR DELETE USING (bucket_id IN ('chat-files', 'chat-wallpapers') AND auth.uid() IS NOT NULL);

-- Добавляем wallpaper_url в chats таблицу если не существует
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'wallpaper_url') THEN
        ALTER TABLE public.chats ADD COLUMN wallpaper_url text;
    END IF;
END $$;

-- Создаем правильные RLS политики для основных таблиц
DROP POLICY IF EXISTS "Users can view chats they are members of" ON public.chats;
DROP POLICY IF EXISTS "Users can update chats they are admins of" ON public.chats;
DROP POLICY IF EXISTS "Users can delete chats they created" ON public.chats;

CREATE POLICY "Users can view chats they are members of" ON public.chats
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = chats.id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update chats they are admins of" ON public.chats
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = chats.id AND user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can delete chats they created" ON public.chats
FOR DELETE USING (created_by = auth.uid());

-- Создаем политики для messages
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.messages;

CREATE POLICY "Users can view messages in their chats" ON public.messages
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = messages.chat_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert messages in their chats" ON public.messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.chat_members 
    WHERE chat_id = messages.chat_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own messages" ON public.messages
FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON public.messages
FOR DELETE USING (sender_id = auth.uid());

-- Создаем политики для chat_members
DROP POLICY IF EXISTS "Users can view chat members" ON public.chat_members;
DROP POLICY IF EXISTS "Users can join chats" ON public.chat_members;
DROP POLICY IF EXISTS "Users can leave chats" ON public.chat_members;

CREATE POLICY "Users can view chat members" ON public.chat_members
FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.chat_members cm 
    WHERE cm.chat_id = chat_members.chat_id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Users can join chats" ON public.chat_members
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can leave chats" ON public.chat_members
FOR DELETE USING (user_id = auth.uid());

-- Создаем политики для profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Включаем RLS на всех таблицах
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
