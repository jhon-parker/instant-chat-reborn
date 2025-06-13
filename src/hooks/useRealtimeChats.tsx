
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Chat {
  id: string;
  name: string;
  avatar_url: string | null;
  updated_at: string;
  is_group: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  chat_type: string;
  last_message?: any;
}

interface UseRealtimeChatsProps {
  onChatUpdate: (chat: Chat) => void;
  onChatDelete: (chatId: string) => void;
}

export function useRealtimeChats({ onChatUpdate, onChatDelete }: UseRealtimeChatsProps) {
  const channelRef = useRef<any>(null);

  useEffect(() => {
    console.log('Setting up realtime for chats');

    // Создаем канал для обновлений чатов
    const channel = supabase
      .channel('chats-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chats'
        },
        (payload) => {
          console.log('New chat created:', payload.new);
          onChatUpdate(payload.new as Chat);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chats'
        },
        (payload) => {
          console.log('Updated chat:', payload.new);
          onChatUpdate(payload.new as Chat);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chats'
        },
        (payload) => {
          console.log('Deleted chat:', payload.old);
          onChatDelete(payload.old.id);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        console.log('Cleaning up realtime channel for chats');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [onChatUpdate, onChatDelete]);

  return channelRef.current;
}
