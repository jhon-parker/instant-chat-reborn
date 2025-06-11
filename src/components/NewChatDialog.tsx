import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Users, Hash, MessageCircle } from 'lucide-react';
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
  const [filteredUsers, setFilteredUsers] = useState<Profile[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [chatType, setChatType] = useState<'personal' | 'group' | 'channel'>('personal');
  
  // Group/Channel creation fields
  const [chatName, setChatName] = useState('');
  const [chatDescription, setChatDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      fetchUsers();
      // Reset form
      setSearchTerm('');
      setSelectedUsers([]);
      setChatName('');
      setChatDescription('');
      setIsPublic(false);
    }
  }, [open]);

  useEffect(() => {
    // Only filter users when search term is not empty
    if (searchTerm.trim() === '') {
      setFilteredUsers([]);
    } else {
      const filtered = users.filter(profile => {
        const fullName = `${profile.first_name} ${profile.last_name}`.toLowerCase();
        const username = profile.username?.toLowerCase() || '';
        const search = searchTerm.toLowerCase();
        
        return fullName.includes(search) || 
               username.includes(search) || 
               (search.startsWith('@') && username.includes(search.slice(1)));
      });
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user?.id);

    if (data) {
      setUsers(data);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const createPersonalChat = async () => {
    if (selectedUsers.length !== 1 || !user) return;

    setIsLoading(true);
    try {
      const otherUser = users.find(u => u.id === selectedUsers[0]);
      const chatName = `${otherUser?.first_name} ${otherUser?.last_name}`;

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: chatName,
          chat_type: 'personal',
          is_group: false,
          created_by: user.id
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add both users as members
      const { error: memberError } = await supabase
        .from('chat_members')
        .insert([
          {
            chat_id: chat.id,
            user_id: user.id,
            role: 'admin'
          },
          {
            chat_id: chat.id,
            user_id: selectedUsers[0],
            role: 'member'
          }
        ]);

      if (memberError) throw memberError;

      toast({ title: 'Чат создан!' });
      onChatCreated(chat.id);
      onOpenChange(false);
      resetForm();

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

  const createGroupOrChannel = async () => {
    if (!chatName.trim() || !user) return;

    setIsLoading(true);
    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: chatName,
          chat_type: chatType,
          description: chatDescription || null,
          is_group: chatType === 'group',
          created_by: user.id,
          settings: {
            is_public: isPublic,
            allow_members_invite: chatType === 'group'
          }
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add creator as admin
      const memberInserts = [{
        chat_id: chat.id,
        user_id: user.id,
        role: 'admin',
        can_add_members: true,
        can_pin_messages: true,
        can_delete_messages: true
      }];

      // Add selected users as members - remove can_send_messages field
      selectedUsers.forEach(userId => {
        memberInserts.push({
          chat_id: chat.id,
          user_id: userId,
          role: 'member',
          can_add_members: false,
          can_pin_messages: false,
          can_delete_messages: false
        });
      });

      const { error: memberError } = await supabase
        .from('chat_members')
        .insert(memberInserts);

      if (memberError) throw memberError;

      const typeText = chatType === 'group' ? 'Группа' : 'Канал';
      toast({ title: `${typeText} создан${chatType === 'group' ? 'а' : ''}!` });
      onChatCreated(chat.id);
      onOpenChange(false);
      resetForm();

    } catch (error: any) {
      toast({
        title: `Ошибка создания ${chatType === 'group' ? 'группы' : 'канала'}`,
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedUsers([]);
    setSearchTerm('');
    setChatName('');
    setChatDescription('');
    setIsPublic(false);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const canCreate = () => {
    if (chatType === 'personal') {
      return selectedUsers.length === 1;
    }
    return chatName.trim().length > 0;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
        </DialogHeader>
        
        <Tabs value={chatType} onValueChange={(value: any) => setChatType(value)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal" className="text-xs">
              <MessageCircle className="h-4 w-4 mr-1" />
              Личный
            </TabsTrigger>
            <TabsTrigger value="group" className="text-xs">
              <Users className="h-4 w-4 mr-1" />
              Группа
            </TabsTrigger>
            <TabsTrigger value="channel" className="text-xs">
              <Hash className="h-4 w-4 mr-1" />
              Канал
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <Input
              placeholder="Поиск пользователей..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />

            <ScrollArea className="h-60">
              {searchTerm.trim() === '' ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Начните вводить имя, фамилию или @username</p>
                </div>
              ) : (
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
                  
                  {filteredUsers.length === 0 && searchTerm.trim() !== '' && (
                    <p className="text-center text-gray-500 py-8">
                      Пользователи не найдены
                    </p>
                  )}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                onClick={createPersonalChat} 
                disabled={!canCreate() || isLoading}
              >
                Создать чат
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div>
              <Label htmlFor="groupName">Название группы</Label>
              <Input
                id="groupName"
                placeholder="Введите название группы..."
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="groupDescription">Описание (необязательно)</Label>
              <Textarea
                id="groupDescription"
                placeholder="Описание группы..."
                value={chatDescription}
                onChange={(e) => setChatDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Публичная группа</Label>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div>
              <Label>Добавить участников</Label>
              <Input
                placeholder="Поиск пользователей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>

            <ScrollArea className="h-40">
              {searchTerm.trim() === '' ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Начните поиск для добавления участников
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => toggleUserSelection(profile.id)}
                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                        selectedUsers.includes(profile.id)
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {getInitials(profile.first_name, profile.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{profile.first_name} {profile.last_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                onClick={createGroupOrChannel} 
                disabled={!canCreate() || isLoading}
              >
                Создать группу ({selectedUsers.length})
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="channel" className="space-y-4">
            <div>
              <Label htmlFor="channelName">Название канала</Label>
              <Input
                id="channelName"
                placeholder="Введите название канала..."
                value={chatName}
                onChange={(e) => setChatName(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="channelDescription">Описание (необязательно)</Label>
              <Textarea
                id="channelDescription"
                placeholder="Описание канала..."
                value={chatDescription}
                onChange={(e) => setChatDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Публичный канал</Label>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>

            <div>
              <Label>Добавить подписчиков</Label>
              <Input
                placeholder="Поиск пользователей..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </div>

            <ScrollArea className="h-40">
              {searchTerm.trim() === '' ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  Начните поиск для добавления подписчиков
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => toggleUserSelection(profile.id)}
                      className={`p-2 rounded cursor-pointer text-sm transition-colors ${
                        selectedUsers.includes(profile.id)
                          ? 'bg-blue-50 border border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={profile.avatar_url || ''} />
                          <AvatarFallback className="text-xs">
                            {getInitials(profile.first_name, profile.last_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{profile.first_name} {profile.last_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Отмена
              </Button>
              <Button 
                onClick={createGroupOrChannel} 
                disabled={!canCreate() || isLoading}
              >
                Создать канал ({selectedUsers.length})
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
