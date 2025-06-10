
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Chat {
  id: string;
  name: string;
  avatar_url: string | null;
  is_group: boolean;
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
}

export function ChatList({ onChatSelect, selectedChatId, onNewChat }: ChatListProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
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
          updated_at
        )
      `)
      .eq('user_id', user.id);

    if (userChats) {
      const chatList = userChats
        .map(item => item.chats)
        .filter(Boolean)
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      
      setChats(chatList as Chat[]);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="w-80 border-r bg-white flex flex-col">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Чаты</h2>
          <Button size="sm" onClick={onNewChat}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredChats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
              selectedChatId === chat.id ? 'bg-blue-50 border-blue-200' : ''
            }`}
          >
            <div className="flex items-center space-x-3">
              <Avatar>
                <AvatarImage src={chat.avatar_url || ''} />
                <AvatarFallback>{getInitials(chat.name || '')}</AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {chat.name}
                  </p>
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
          </div>
        ))}
        
        {filteredChats.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <p>Нет чатов</p>
            <Button variant="link" onClick={onNewChat} className="mt-2">
              Создать новый чат
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
