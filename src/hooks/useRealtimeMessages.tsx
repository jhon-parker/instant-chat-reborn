
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: string;
  content: string | null;
  sender_id: string;
  chat_id: string;
  created_at: string;
  message_type: string | null;
  file_url: string | null;
  file_name: string | null;
  reply_to: string | null;
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

    // Создаем канал для реального времени
    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
        },
        (payload) => {
          console.log('New message:', payload.new);
          onNewMessage(payload.new as Message);
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
        (payload) => {
          console.log('Updated message:', payload.new);
          onMessageUpdate(payload.new as Message);
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
          console.log('Deleted message:', payload.old);
          onMessageDelete(payload.old.id);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatId, onNewMessage, onMessageUpdate, onMessageDelete]);

  return channelRef.current;
}
