
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Search, Users, Radio, Upload } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: (chatId: string) => void;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  avatar_url: string | null;
}

export function NewChatDialog({ open, onOpenChange, onChatCreated }: NewChatDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [isPublicGroup, setIsPublicGroup] = useState(false);
  const [groupAvatar, setGroupAvatar] = useState<File | null>(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setUsers([]);
      setSelectedUsers([]);
      setGroupName('');
      setGroupDescription('');
      setIsPublicGroup(false);
      setGroupAvatar(null);
      setGroupAvatarPreview(null);
    }
  }, [open]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers();
    } else {
      setUsers([]);
    }
  }, [searchQuery]);

  const searchUsers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, username, avatar_url')
        .neq('id', user.id)
        .or(`first_name.ilike.%${searchQuery}%,last_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%`)
        .limit(10);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error('Error searching users:', error);
    }
  };

  const createPersonalChat = async (otherUserId: string) => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('find_or_create_personal_chat', {
        other_user_id: otherUserId
      });

      if (error) throw error;

      toast({ title: 'Чат создан' });
      onChatCreated(data);
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

  const uploadGroupAvatar = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `group-avatars/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const createGroup = async () => {
    if (!user || !groupName.trim() || selectedUsers.length === 0) {
      toast({
        title: 'Заполните все поля',
        description: 'Укажите название группы и выберите участников',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      let avatarUrl = null;
      if (groupAvatar) {
        avatarUrl = await uploadGroupAvatar(groupAvatar);
      }

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name: groupName,
          description: groupDescription,
          is_group: true,
          chat_type: isPublicGroup ? 'channel' : 'group',
          created_by: user.id,
          avatar_url: avatarUrl,
          member_count: selectedUsers.length + 1
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add creator as admin
      const members = [
        { chat_id: chat.id, user_id: user.id, role: 'admin' },
        ...selectedUsers.map(userId => ({
          chat_id: chat.id,
          user_id: userId,
          role: 'member'
        }))
      ];

      const { error: membersError } = await supabase
        .from('chat_members')
        .insert(members);

      if (membersError) throw membersError;

      toast({ 
        title: isPublicGroup ? 'Канал создан' : 'Группа создана' 
      });
      onChatCreated(chat.id);
    } catch (error: any) {
      toast({
        title: 'Ошибка создания',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedUsers(prev => [...prev, userId]);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setGroupAvatar(file);
      const reader = new FileReader();
      reader.onload = () => {
        setGroupAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const getDisplayName = (user: User) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
    return fullName || user.username || 'Пользователь';
  };

  const getInitials = (user: User) => {
    const firstName = user.first_name || '';
    const lastName = user.last_name || '';
    return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || '?';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="personal" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal">Личный</TabsTrigger>
            <TabsTrigger value="group">
              <Users className="h-4 w-4 mr-1" />
              Группа
            </TabsTrigger>
            <TabsTrigger value="channel">
              <Radio className="h-4 w-4 mr-1" />
              Канал
            </TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Поиск пользователей..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                  onClick={() => createPersonalChat(user.id)}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback>{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{getDisplayName(user)}</p>
                    {user.username && (
                      <p className="text-sm text-gray-500">@{user.username}</p>
                    )}
                  </div>
                </div>
              ))}
              
              {searchQuery.length >= 2 && users.length === 0 && (
                <p className="text-center text-gray-500 py-4">
                  Пользователи не найдены
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-16 h-16 cursor-pointer" onClick={() => document.getElementById('group-avatar')?.click()}>
                  <AvatarImage src={groupAvatarPreview || ''} />
                  <AvatarFallback>
                    <Upload className="h-6 w-6 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
                <input
                  id="group-avatar"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="group-name">Название группы</Label>
                <Input
                  id="group-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Введите название..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="group-description">Описание (необязательно)</Label>
              <Textarea
                id="group-description"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Описание группы..."
                rows={3}
              />
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Добавить участников..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="space-y-2">
                <Label>Выбранные участники ({selectedUsers.length})</Label>
                <div className="flex flex-wrap gap-2">
                  {users
                    .filter(u => selectedUsers.includes(u.id))
                    .map(user => (
                      <div
                        key={user.id}
                        className="flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm cursor-pointer"
                        onClick={() => handleUserSelect(user.id)}
                      >
                        <span>{getDisplayName(user)}</span>
                        <span>×</span>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {users.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center space-x-3 p-2 rounded-lg cursor-pointer ${
                    selectedUsers.includes(user.id) 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleUserSelect(user.id)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={user.avatar_url || ''} />
                    <AvatarFallback className="text-xs">{getInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{getDisplayName(user)}</p>
                    {user.username && (
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    )}
                  </div>
                  {selectedUsers.includes(user.id) && (
                    <div className="w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <Button 
              onClick={createGroup} 
              disabled={isLoading || !groupName.trim() || selectedUsers.length === 0}
              className="w-full"
            >
              {isLoading ? 'Создание...' : 'Создать группу'}
            </Button>
          </TabsContent>

          <TabsContent value="channel" className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-16 h-16 cursor-pointer" onClick={() => document.getElementById('channel-avatar')?.click()}>
                  <AvatarImage src={groupAvatarPreview || ''} />
                  <AvatarFallback>
                    <Upload className="h-6 w-6 text-gray-400" />
                  </AvatarFallback>
                </Avatar>
                <input
                  id="channel-avatar"
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="channel-name">Название канала</Label>
                <Input
                  id="channel-name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Введите название..."
                />
              </div>
            </div>

            <div>
              <Label htmlFor="channel-description">Описание канала</Label>
              <Textarea
                id="channel-description"
                value={groupDescription}
                onChange={(e) => setGroupDescription(e.target.value)}
                placeholder="Расскажите, о чем ваш канал..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Публичный канал</Label>
                <p className="text-sm text-gray-500">Любой сможет найти канал в поиске</p>
              </div>
              <Switch
                checked={isPublicGroup}
                onCheckedChange={setIsPublicGroup}
              />
            </div>

            <Button 
              onClick={() => {
                setIsPublicGroup(true);
                createGroup();
              }} 
              disabled={isLoading || !groupName.trim()}
              className="w-full"
            >
              {isLoading ? 'Создание...' : 'Создать канал'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
