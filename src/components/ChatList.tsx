
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Search, MoreVertical, Pin, Archive, Trash, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Chat {
  id: string;
  name: string;
  avatar_url: string | null;
  is_group: boolean;
  chat_type: string;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  updated_at: string;
  last_message?: {
    content: string;
    created_at: string;
  };
}

interface ChatListProps {
  onChatSelect: (chatId: string) => void;
  selectedChatId: string | null;
  onNewChat: () => void;
  onProfileSettings: () => void;
}

export function ChatList({ onChatSelect, selectedChatId, onNewChat, onProfileSettings }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    fetchChats();

    // Subscribe to real-time updates
    const chatsSubscription = supabase
      .channel('chats_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chats'
      }, () => {
        fetchChats();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_members'
      }, () => {
        fetchChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(chatsSubscription);
    };
  }, [user]);

  const fetchChats = async () => {
    if (!user) return;

    const { data: userChats } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        chats (
          id,
          name,
          avatar_url,
          is_group,
          chat_type,
          is_pinned,
          is_archived,
          is_muted,
          updated_at
        )
      `)
      .eq('user_id', user.id);

    if (userChats) {
      const chatList = userChats
        .map(item => item.chats)
        .filter(Boolean)
        .sort((a, b) => {
          // Pin pinned chats at the top
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          // Then sort by updated_at
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });
      
      setChats(chatList as Chat[]);
    }
  };

  const togglePin = async (chatId: string, isPinned: boolean) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ is_pinned: !isPinned })
        .eq('id', chatId);

      if (error) throw error;

      toast({ 
        title: isPinned ? 'Чат откреплён' : 'Чат закреплён' 
      });
      fetchChats();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const toggleArchive = async (chatId: string, isArchived: boolean) => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ is_archived: !isArchived })
        .eq('id', chatId);

      if (error) throw error;

      toast({ 
        title: isArchived ? 'Чат разархивирован' : 'Чат архивирован' 
      });
      fetchChats();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const deleteChat = async (chatId: string) => {
    try {
      // Remove user from chat
      const { error } = await supabase
        .from('chat_members')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({ title: 'Чат удалён' });
      fetchChats();
    } catch (error: any) {
      toast({
        title: 'Ошибка удаления чата',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesArchiveFilter = showArchived ? chat.is_archived : !chat.is_archived;
    return matchesSearch && matchesArchiveFilter;
  });

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'вчера';
    } else {
      return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }
  };

  const getChatIcon = (chat: Chat) => {
    if (chat.chat_type === 'channel') return '📢';
    if (chat.is_group) return '👥';
    return null;
  };

  const archivedCount = chats.filter(chat => chat.is_archived).length;

  return (
    <div className="w-80 border-r bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Чаты</h2>
          <div className="flex items-center space-x-2">
            <Button size="sm" onClick={onNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onProfileSettings}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex space-x-2">
          <Button
            variant={!showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(false)}
          >
            Все чаты
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
          >
            Архив {archivedCount > 0 && `(${archivedCount})`}
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors relative ${
              selectedChatId === chat.id ? 'bg-blue-50 border-blue-200' : ''
            } ${chat.is_muted ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center space-x-3" onClick={() => onChatSelect(chat.id)}>
              <div className="relative">
                <Avatar>
                  <AvatarImage src={chat.avatar_url || ''} />
                  <AvatarFallback>{getInitials(chat.name || '')}</AvatarFallback>
                </Avatar>
                {getChatIcon(chat) && (
                  <span className="absolute -bottom-1 -right-1 text-sm bg-white rounded-full w-5 h-5 flex items-center justify-center border">
                    {getChatIcon(chat)}
                  </span>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {chat.name}
                    </p>
                    {chat.is_pinned && <Pin className="h-3 w-3 text-gray-500" />}
                    {chat.is_muted && <span className="text-xs text-gray-400">🔇</span>}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatTime(chat.updated_at)}
                  </span>
                </div>
                
                {chat.last_message && (
                  <p className="text-sm text-gray-500 truncate">
                    {chat.last_message.content}
                  </p>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => togglePin(chat.id, chat.is_pinned)}>
                  <Pin className="h-4 w-4 mr-2" />
                  {chat.is_pinned ? 'Открепить' : 'Закрепить'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleArchive(chat.id, chat.is_archived)}>
                  <Archive className="h-4 w-4 mr-2" />
                  {chat.is_archived ? 'Разархивировать' : 'Архивировать'}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => deleteChat(chat.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Удалить чат
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        
        {filteredChats.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>{showArchived ? 'Нет архивированных чатов' : 'Нет чатов'}</p>
            {!showArchived && (
              <Button variant="link" onClick={onNewChat} className="mt-2">
                Создать новый чат
              </Button>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
