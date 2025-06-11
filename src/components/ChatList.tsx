
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, MessageCircle, Pin, Archive, VolumeX } from 'lucide-react';
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
}

export function ChatList({ selectedChatId, onChatSelect }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    fetchChats();

    // Subscribe to real-time updates
    const chatsSubscription = supabase
      .channel('chats_channel')
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
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
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

    try {
      const { data } = await supabase
        .from('chat_members')
        .select(`
          chat_id,
          chats (
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

      if (data) {
        const chatList = data
          .filter(item => item.chats)
          .map(item => item.chats as Chat)
          .filter(chat => showArchived ? chat.is_archived : !chat.is_archived);

        // Sort by pinned, then by last update
        chatList.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        setChats(chatList);
      }
    } catch (error) {
      console.error('Error fetching chats:', error);
    }
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

  return (
    <div className="w-80 border-r bg-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Чаты</h2>
          <Button onClick={() => setShowNewChatDialog(true)} size="sm">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
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
            <div className="text-center text-gray-500 mt-8">
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
                  className={`p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-50 ${
                    selectedChatId === chat.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                  onClick={() => onChatSelect(chat.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar>
                        <AvatarImage src={chat.avatar_url || ''} />
                        <AvatarFallback>{getInitials(chat.name || '')}</AvatarFallback>
                      </Avatar>
                      {chat.is_muted && (
                        <VolumeX className="absolute -bottom-1 -right-1 h-3 w-3 bg-gray-500 text-white rounded-full p-0.5" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1">
                          {chat.is_pinned && (
                            <Pin className="h-3 w-3 text-blue-500" />
                          )}
                          <p className={`font-medium truncate ${
                            chat.unread_count ? 'text-gray-900' : 'text-gray-700'
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
                          <span className="text-xs text-gray-400">
                            {formatTime(chat.updated_at)}
                          </span>
                        </div>
                      </div>
                      
                      {chat.last_message && (
                        <p className="text-sm text-gray-500 truncate mt-1">
                          {chat.is_group && (
                            <span className="text-blue-600">
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
