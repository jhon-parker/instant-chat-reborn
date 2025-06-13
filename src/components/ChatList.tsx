
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRealtimeChats } from '@/hooks/useRealtimeChats';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, MessageCircle, Pin, Archive, VolumeX, Settings } from 'lucide-react';
import { NewChatDialog } from '@/components/NewChatDialog';
import { ChatContextMenu } from '@/components/ChatContextMenu';

interface Chat {
  id: string;
  name: string;
  avatar_url: string | null;
  is_group: boolean;
  is_pinned: boolean;
  is_archived: boolean;
  is_muted: boolean;
  chat_type: string;
  invite_link?: string;
  updated_at: string;
  unread_count?: number;
  last_message?: {
    content: string;
    created_at: string;
    sender_name: string;
  };
}

interface ChatListProps {
  selectedChatId?: string;
  onChatSelect: (chatId: string) => void;
  onProfileSettings: () => void;
}

export function ChatList({ selectedChatId, onChatSelect, onProfileSettings }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // Функции для обновления чатов в реальном времени
  const handleChatUpdate = (updatedChat: Chat) => {
    setChats(prev => prev.map(chat => 
      chat.id === updatedChat.id ? { ...chat, ...updatedChat } : chat
    ));
  };

  const handleChatDelete = (chatId: string) => {
    setChats(prev => prev.filter(chat => chat.id !== chatId));
  };

  // Используем хук для реалтайм обновлений
  useRealtimeChats({
    onChatUpdate: handleChatUpdate,
    onChatDelete: handleChatDelete
  });

  useEffect(() => {
    if (!user) return;
    fetchChats();
  }, [user, showArchived]);

  const fetchChats = async () => {
    if (!user) return;

    try {
      setIsLoading(true);
      console.log('Fetching chats for user:', user.id);

      // Получаем чаты через chat_members
      const { data: chatMembersData, error: membersError } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          chats!inner (
            id,
            name,
            avatar_url,
            is_group,
            is_pinned,
            is_archived,
            is_muted,
            chat_type,
            invite_link,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      if (membersError) {
        console.error('Error fetching chat members:', membersError);
        return;
      }

      console.log('Chat members data:', chatMembersData);

      if (chatMembersData && chatMembersData.length > 0) {
        const chatList = chatMembersData
          .filter(item => item.chats)
          .map(item => ({
            ...(item.chats as any),
            unread_count: 0
          }))
          .filter(chat => showArchived ? chat.is_archived : !chat.is_archived);

        console.log('Processed chat list:', chatList);

        // Для персональных чатов получаем данные другого пользователя
        for (const chat of chatList) {
          if (!chat.is_group && chat.chat_type === 'personal') {
            try {
              const { data: members } = await supabase
                .from('chat_members')
                .select(`
                  user_id,
                  profiles!inner(first_name, last_name, avatar_url)
                `)
                .eq('chat_id', chat.id)
                .neq('user_id', user.id);

              if (members && members.length > 0) {
                const otherUser = members[0].profiles as any;
                chat.name = `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || 'Пользователь';
                chat.avatar_url = otherUser.avatar_url;
              }
            } catch (error) {
              console.error('Error fetching other user profile:', error);
            }
          }
        }

        // Сортировка: закрепленные сверху, затем по активности
        chatList.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        setChats(chatList);
      } else {
        console.log('No chats found for user');
        setChats([]);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
      setChats([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatSelect = (chatId: string) => {
    onChatSelect(chatId);
  };

  const filteredChats = chats.filter(chat =>
    chat.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit'
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  };

  if (isLoading) {
    return (
      <div className="w-80 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Чаты</h2>
            <div className="flex items-center space-x-2">
              <Button onClick={() => setShowNewChatDialog(true)} size="sm">
                <MessageCircle className="h-4 w-4" />
              </Button>
              <Button onClick={onProfileSettings} size="sm" variant="outline">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Загрузка чатов...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 border-r bg-card flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Чаты</h2>
          <div className="flex items-center space-x-2">
            <Button onClick={() => setShowNewChatDialog(true)} size="sm">
              <MessageCircle className="h-4 w-4" />
            </Button>
            <Button onClick={onProfileSettings} size="sm" variant="outline">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Поиск чатов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex space-x-2 mt-3">
          <Button
            variant={!showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(false)}
          >
            Активные
          </Button>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived(true)}
          >
            <Archive className="h-4 w-4 mr-1" />
            Архив
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredChats.length === 0 ? (
            <div className="text-center text-muted-foreground mt-8">
              {showArchived ? 'Нет архивных чатов' : 'Нет активных чатов'}
            </div>
          ) : (
            filteredChats.map((chat) => (
              <ChatContextMenu
                key={chat.id}
                chat={chat}
                onUpdate={fetchChats}
              >
                <div
                  className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-accent ${
                    selectedChatId === chat.id ? 'bg-accent border-l-4 border-primary' : ''
                  }`}
                  onClick={() => handleChatSelect(chat.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={chat.avatar_url || ''} />
                        <AvatarFallback>{getInitials(chat.name || '')}</AvatarFallback>
                      </Avatar>
                      {chat.is_muted && (
                        <VolumeX className="absolute -bottom-1 -right-1 h-3 w-3 bg-muted text-muted-foreground rounded-full p-0.5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          {chat.is_pinned && (
                            <Pin className="h-3 w-3 text-primary" />
                          )}
                          <p className={`font-medium truncate ${
                            chat.unread_count && chat.unread_count > 0 ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {chat.name}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1">
                          {chat.unread_count && chat.unread_count > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {chat.unread_count > 99 ? '99+' : chat.unread_count}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatTime(chat.updated_at)}
                          </span>
                        </div>
                      </div>
                      
                      {chat.last_message && (
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {chat.is_group && (
                            <span className="text-primary">
                              {chat.last_message.sender_name}: 
                            </span>
                          )}
                          {chat.last_message.content || 'Медиафайл'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </ChatContextMenu>
            ))
          )}
        </div>
      </ScrollArea>

      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onChatCreated={(chatId) => {
          setShowNewChatDialog(false);
          onChatSelect(chatId);
          fetchChats();
        }}
      />
    </div>
  );
}
