
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Upload, Users, Megaphone, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: (chatId: string) => void;
}

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export function NewChatDialog({ open, onOpenChange, onChatCreated }: NewChatDialogProps) {
  const [chatType, setChatType] = useState<'personal' | 'group' | 'channel'>('personal');
  const [chatName, setChatName] = useState('');
  const [chatDescription, setChatDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchUsers = async (term: string) => {
    if (!term.trim()) {
      setUsers([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url')
        .neq('id', user?.id)
        .or(`username.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%`)
        .limit(10);

      setUsers(data || []);
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    searchUsers(value);
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const findOrCreatePersonalChat = async (otherUserId: string) => {
    if (!user) throw new Error('No user');

    // Check if a personal chat already exists between these two users
    const { data: existingChats } = await supabase
      .from('chat_members')
      .select(`
        chat_id,
        chats!inner (
          id,
          is_group,
          chat_type
        )
      `)
      .eq('user_id', user.id)
      .in('chats.chat_type', ['personal']);

    if (existingChats) {
      for (const chatMember of existingChats) {
        const { data: otherMembers } = await supabase
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', chatMember.chat_id)
          .neq('user_id', user.id);

        if (otherMembers && otherMembers.length === 1 && otherMembers[0].user_id === otherUserId) {
          return chatMember.chat_id;
        }
      }
    }

    // Create new personal chat
    const otherUser = users.find(u => u.id === otherUserId);
    const chatName = `${otherUser?.first_name || ''} ${otherUser?.last_name || ''}`.trim() || otherUser?.username || 'Чат';

    const { data: newChat, error: chatError } = await supabase
      .from('chats')
      .insert({
        name: chatName,
        chat_type: 'personal',
        is_group: false,
        created_by: user.id,
        avatar_url: otherUser?.avatar_url
      })
      .select()
      .single();

    if (chatError) throw chatError;

    // Add both users to the chat
    const { error: membersError } = await supabase
      .from('chat_members')
      .insert([
        {
          chat_id: newChat.id,
          user_id: user.id,
          role: 'admin'
        },
        {
          chat_id: newChat.id,
          user_id: otherUserId,
          role: 'member'
        }
      ]);

    if (membersError) throw membersError;

    return newChat.id;
  };

  const generateInviteLink = () => {
    return `${window.location.origin}/invite/${Math.random().toString(36).substr(2, 9)}`;
  };

  const createChat = async () => {
    if (!user) return;

    if (chatType === 'personal' && selectedUsers.length !== 1) {
      toast({
        title: 'Ошибка',
        description: 'Выберите одного пользователя для личного чата',
        variant: 'destructive'
      });
      return;
    }

    if ((chatType === 'group' || chatType === 'channel') && (!chatName.trim() || selectedUsers.length === 0)) {
      toast({
        title: 'Ошибка',
        description: 'Заполните название и выберите участников',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);

    try {
      let chatId: string;

      if (chatType === 'personal') {
        chatId = await findOrCreatePersonalChat(selectedUsers[0]);
      } else {
        let avatarUrl = null;
        if (avatarFile) {
          avatarUrl = await uploadAvatar(avatarFile);
        }

        const inviteLink = (chatType === 'group' || chatType === 'channel') ? generateInviteLink() : null;

        const { data: newChat, error: chatError } = await supabase
          .from('chats')
          .insert({
            name: chatName,
            description: chatDescription || null,
            chat_type: chatType,
            is_group: chatType === 'group',
            created_by: user.id,
            avatar_url: avatarUrl,
            invite_link: inviteLink
          })
          .select()
          .single();

        if (chatError) throw chatError;

        // Add creator as admin
        const membersToAdd = [
          {
            chat_id: newChat.id,
            user_id: user.id,
            role: 'admin',
            can_add_members: true,
            can_pin_messages: true,
            can_delete_messages: true
          },
          // Add selected users as members
          ...selectedUsers.map(userId => ({
            chat_id: newChat.id,
            user_id: userId,
            role: 'member' as const
          }))
        ];

        const { error: membersError } = await supabase
          .from('chat_members')
          .insert(membersToAdd);

        if (membersError) throw membersError;

        chatId = newChat.id;
      }

      toast({ title: 'Чат создан успешно!' });
      onChatCreated(chatId);
      onOpenChange(false);
      
      // Reset form
      setChatName('');
      setChatDescription('');
      setSelectedUsers([]);
      setSearchTerm('');
      setUsers([]);
      setAvatarFile(null);
      setAvatarPreview(null);
      
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

  const getDisplayName = (user: User) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.username || 'Пользователь';
  };

  const getInitials = (user: User) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || user.username?.[0]?.toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
        </DialogHeader>

        <Tabs value={chatType} onValueChange={(value) => setChatType(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">
              <MessageSquare className="h-4 w-4 mr-2" />
              Личный
            </TabsTrigger>
            <TabsTrigger value="group">
              <Users className="h-4 w-4 mr-2" />
              Группа
            </TabsTrigger>
            <TabsTrigger value="channel">
              <Megaphone className="h-4 w-4 mr-2" />
              Канал
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Найти пользователя..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-48">
              {isSearching ? (
                <p className="text-center text-gray-500 py-4">Поиск...</p>
              ) : users.length === 0 && searchTerm ? (
                <p className="text-center text-gray-500 py-4">Пользователи не найдены</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedUsers.includes(u.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        setSelectedUsers([u.id]);
                      }}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={u.avatar_url || ''} />
                          <AvatarFallback className="text-xs">{getInitials(u)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{getDisplayName(u)}</p>
                          {u.username && (
                            <p className="text-sm text-gray-500">@{u.username}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-16 h-16 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarImage src={avatarPreview || ''} />
                  <AvatarFallback>
                    <Upload className="h-6 w-6 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Название группы"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                />
                <Input
                  placeholder="Описание (необязательно)"
                  value={chatDescription}
                  onChange={(e) => setChatDescription(e.target.value)}
                />
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Добавить участников..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-32">
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedUsers.includes(u.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleUserSelection(u.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{getInitials(u)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{getDisplayName(u)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="channel" className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-16 h-16 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarImage src={avatarPreview || ''} />
                  <AvatarFallback>
                    <Upload className="h-6 w-6 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Название канала"
                  value={chatName}
                  onChange={(e) => setChatName(e.target.value)}
                />
                <Textarea
                  placeholder="Описание канала"
                  value={chatDescription}
                  onChange={(e) => setChatDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Добавить администраторов..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            <ScrollArea className="h-32">
              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                      selectedUsers.includes(u.id) ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleUserSelection(u.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={u.avatar_url || ''} />
                        <AvatarFallback className="text-xs">{getInitials(u)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{getDisplayName(u)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={createChat} 
            disabled={
              isLoading || 
              (chatType === 'personal' && selectedUsers.length !== 1) ||
              ((chatType === 'group' || chatType === 'channel') && (!chatName.trim() || selectedUsers.length === 0))
            }
          >
            {isLoading ? 'Создание...' : 'Создать'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
