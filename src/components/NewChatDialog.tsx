
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
  username: string | null;
}

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: (chatId: string) => void;
}

export function NewChatDialog({ open, onOpenChange, onChatCreated }: NewChatDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id);

    if (data) {
      setUsers(data);
    }
  };

  const filteredUsers = users.filter(profile => {
    const fullName = `${profile.first_name} ${profile.last_name}`.toLowerCase();
    const username = profile.username?.toLowerCase() || '';
    return fullName.includes(searchTerm.toLowerCase()) || 
           username.includes(searchTerm.toLowerCase());
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createChat = async () => {
    if (selectedUsers.length === 0 || !user) return;

    setIsLoading(true);

    try {
      // Determine chat type and name
      const isGroup = selectedUsers.length > 1;
      let chatName = '';
      
      if (isGroup) {
        const selectedProfiles = users.filter(u => selectedUsers.includes(u.id));
        chatName = selectedProfiles.map(p => `${p.first_name} ${p.last_name}`).join(', ');
      } else {
        const otherUser = users.find(u => u.id === selectedUsers[0]);
        chatName = `${otherUser?.first_name} ${otherUser?.last_name}`;
      }

      // Create chat
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: chatName,
          is_group: isGroup,
          created_by: user.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add current user as admin
      const { error: memberError1 } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chat.id,
          user_id: user.id,
          role: 'admin'
        });

      if (memberError1) throw memberError1;

      // Add selected users as members
      const memberInserts = selectedUsers.map(userId => ({
        chat_id: chat.id,
        user_id: userId,
        role: 'member'
      }));

      const { error: memberError2 } = await supabase
        .from('chat_members')
        .insert(memberInserts);

      if (memberError2) throw memberError2;

      toast({ title: 'Чат создан!' });
      onChatCreated(chat.id);
      onOpenChange(false);
      setSelectedUsers([]);
      setSearchTerm('');

    } catch (error: any) {
      toast({
        title: 'Ошибка создания чата',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Input
            placeholder="Поиск пользователей..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <ScrollArea className="h-60">
            <div className="space-y-2">
              {filteredUsers.map((profile) => (
                <div
                  key={profile.id}
                  onClick={() => toggleUserSelection(profile.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedUsers.includes(profile.id)
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarImage src={profile.avatar_url || ''} />
                      <AvatarFallback>
                        {getInitials(profile.first_name, profile.last_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {profile.first_name} {profile.last_name}
                      </p>
                      {profile.username && (
                        <p className="text-sm text-gray-500">@{profile.username}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {filteredUsers.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  Пользователи не найдены
                </p>
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button 
              onClick={createChat} 
              disabled={selectedUsers.length === 0 || isLoading}
            >
              Создать ({selectedUsers.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
