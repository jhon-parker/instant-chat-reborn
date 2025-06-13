
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: string;
  file_url?: string;
  file_name?: string;
  formatted_content?: any;
  profiles?: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface UseRealtimeMessagesProps {
  chatId: string;
  onNewMessage: (message: Message) => void;
  onMessageUpdate: (message: Message) => void;
  onMessageDelete: (messageId: string) => void;
}

export function useRealtimeMessages({ 
  chatId, 
  onNewMessage, 
  onMessageUpdate, 
  onMessageDelete 
}: UseRealtimeMessagesProps) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!chatId) return;

    console.log('Setting up realtime for chat:', chatId);

    // Создаем канал для сообщений конкретного чата
    const channel = supabase
      .channel(`messages-${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          console.log('New message received:', payload.new);
          
          // Получаем профиль отправителя
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const messageWithProfile = {
            ...payload.new,
            profiles: profile
          } as Message;

          onNewMessage(messageWithProfile);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        async (payload) => {
          console.log('Message updated:', payload.new);
          
          // Получаем профиль отправителя
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, avatar_url')
            .eq('id', payload.new.sender_id)
            .single();

          const messageWithProfile = {
            ...payload.new,
            profiles: profile
          } as Message;

          onMessageUpdate(messageWithProfile);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          console.log('Message deleted:', payload.old);
          onMessageDelete(payload.old.id);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('Cleaning up realtime channel for chat:', chatId);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId, onNewMessage, onMessageUpdate, onMessageDelete]);

  return channelRef.current;
}
