
import { useRef } from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu';
import { Pin, Archive, ArchiveRestore, Link, Trash2, LogOut, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

interface ChatContextMenuProps {
  children: React.ReactNode;
  chat: {
    id: string;
    name: string;
    is_pinned: boolean;
    is_archived: boolean;
    is_muted: boolean;
    is_group: boolean;
    chat_type: string;
    invite_link?: string;
  };
  onUpdate: () => void;
}

export function ChatContextMenu({ children, chat, onUpdate }: ChatContextMenuProps) {
  const { user } = useAuth();

  const handlePinChat = async () => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ is_pinned: !chat.is_pinned })
        .eq('id', chat.id);

      if (error) throw error;

      toast({
        title: chat.is_pinned ? 'Чат откреплен' : 'Чат закреплен'
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleArchiveChat = async () => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ is_archived: !chat.is_archived })
        .eq('id', chat.id);

      if (error) throw error;

      toast({
        title: chat.is_archived ? 'Чат восстановлен из архива' : 'Чат добавлен в архив'
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleMuteChat = async () => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ is_muted: !chat.is_muted })
        .eq('id', chat.id);

      if (error) throw error;

      toast({
        title: chat.is_muted ? 'Уведомления включены' : 'Уведомления отключены'
      });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleCopyInviteLink = async () => {
    if (chat.invite_link) {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${chat.invite_link}`);
      toast({ title: 'Ссылка скопирована в буфер обмена' });
    } else {
      // Генерируем ссылку приглашения для групп и каналов
      if (chat.is_group || chat.chat_type === 'channel') {
        try {
          const inviteCode = Math.random().toString(36).substring(2, 15);
          const { error } = await supabase
            .from('chats')
            .update({ invite_link: inviteCode })
            .eq('id', chat.id);

          if (error) throw error;

          await navigator.clipboard.writeText(`${window.location.origin}/invite/${inviteCode}`);
          toast({ title: 'Ссылка приглашения создана и скопирована' });
          onUpdate();
        } catch (error: any) {
          toast({
            title: 'Ошибка создания ссылки',
            description: error.message,
            variant: 'destructive'
          });
        }
      }
    }
  };

  const handleLeaveChat = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chat.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: 'Вы покинули чат' });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDeleteChat = async () => {
    try {
      // Сначала удаляем всех участников
      await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chat.id);

      // Затем удаляем сообщения
      await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chat.id);

      // Наконец удаляем сам чат
      const { error } = await supabase
        .from('chats')
        .delete()
        .eq('id', chat.id);

      if (error) throw error;

      toast({ title: 'Чат удален' });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка удаления',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={handlePinChat}>
          <Pin className="mr-2 h-4 w-4" />
          {chat.is_pinned ? 'Открепить' : 'Закрепить'}
        </ContextMenuItem>

        <ContextMenuItem onClick={handleMuteChat}>
          {chat.is_muted ? (
            <Volume2 className="mr-2 h-4 w-4" />
          ) : (
            <VolumeX className="mr-2 h-4 w-4" />
          )}
          {chat.is_muted ? 'Включить уведомления' : 'Отключить уведомления'}
        </ContextMenuItem>

        <ContextMenuItem onClick={handleArchiveChat}>
          {chat.is_archived ? (
            <ArchiveRestore className="mr-2 h-4 w-4" />
          ) : (
            <Archive className="mr-2 h-4 w-4" />
          )}
          {chat.is_archived ? 'Восстановить из архива' : 'Добавить в архив'}
        </ContextMenuItem>

        {(chat.is_group || chat.chat_type === 'channel') && (
          <ContextMenuItem onClick={handleCopyInviteLink}>
            <Link className="mr-2 h-4 w-4" />
            Копировать ссылку приглашения
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {chat.is_group && (
          <ContextMenuItem onClick={handleLeaveChat} className="text-orange-600">
            <LogOut className="mr-2 h-4 w-4" />
            Покинуть чат
          </ContextMenuItem>
        )}

        <ContextMenuItem onClick={handleDeleteChat} className="text-red-600">
          <Trash2 className="mr-2 h-4 w-4" />
          Удалить чат
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
