
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Upload, User, Shield, Bell } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ProfileData {
  first_name: string;
  last_name: string;
  username: string;
  bio: string;
  phone: string;
  avatar_url: string | null;
}

interface PrivacySettings {
  show_phone: string;
  show_last_seen: string;
  show_profile_photo: string;
  allow_calls: string;
  allow_groups: string;
}

interface NotificationSettings {
  sound: boolean;
  vibration: boolean;
  preview: boolean;
  group_notifications: boolean;
}

export function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    username: '',
    bio: '',
    phone: '',
    avatar_url: null
  });

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings>({
    show_phone: 'everyone',
    show_last_seen: 'everyone', 
    show_profile_photo: 'everyone',
    allow_calls: 'everyone',
    allow_groups: 'everyone'
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    sound: true,
    vibration: true,
    preview: true,
    group_notifications: true
  });

  useEffect(() => {
    if (open && user) {
      fetchProfile();
    }
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfileData({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          username: data.username || '',
          bio: data.bio || '',
          phone: data.phone || '',
          avatar_url: data.avatar_url
        });

        // Type assertion for JSON data
        const privacy = data.privacy_settings as any;
        const notifications = data.notification_settings as any;

        setPrivacySettings(privacy as PrivacySettings);
        setNotificationSettings(notifications as NotificationSettings);
        setAvatarPreview(data.avatar_url);
      }
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки профиля',
        description: error.message,
        variant: 'destructive'
      });
    }
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
    const fileName = `${user?.id}.${fileExt}`;
    const filePath = `avatars/${fileName}`;

    // Delete old avatar if exists
    if (profileData.avatar_url) {
      const oldPath = profileData.avatar_url.split('/').pop();
      if (oldPath) {
        await supabase.storage.from('avatars').remove([`avatars/${oldPath}`]);
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const saveProfile = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      let avatarUrl = profileData.avatar_url;

      if (avatarFile) {
        avatarUrl = await uploadAvatar(avatarFile);
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profileData.first_name,
          last_name: profileData.last_name,
          username: profileData.username,
          bio: profileData.bio,
          phone: profileData.phone,
          avatar_url: avatarUrl,
          privacy_settings: privacySettings as any,
          notification_settings: notificationSettings as any
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Профиль обновлен' });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Ошибка сохранения',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    return `${profileData.first_name[0] || ''}${profileData.last_name[0] || ''}`.toUpperCase() || '?';
  };

  const privacyOptions = [
    { value: 'everyone', label: 'Все' },
    { value: 'contacts', label: 'Контакты' },
    { value: 'nobody', label: 'Никто' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки профиля</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Профиль
            </TabsTrigger>
            <TabsTrigger value="privacy">
              <Shield className="h-4 w-4 mr-2" />
              Приватность
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Уведомления
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4">
            <div className="flex flex-col items-center space-y-4">
              <div className="relative">
                <Avatar className="w-24 h-24 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <AvatarImage src={avatarPreview || ''} />
                  <AvatarFallback className="text-lg">
                    {avatarPreview ? getInitials() : <Upload className="h-8 w-8 text-gray-400" />}
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
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Изменить фото
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Имя</Label>
                <Input
                  id="first_name"
                  value={profileData.first_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, first_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Фамилия</Label>
                <Input
                  id="last_name"
                  value={profileData.last_name}
                  onChange={(e) => setProfileData(prev => ({ ...prev, last_name: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                value={profileData.username}
                onChange={(e) => setProfileData(prev => ({ ...prev, username: e.target.value }))}
                placeholder="@username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Телефон</Label>
              <Input
                id="phone"
                value={profileData.phone}
                onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+7 (999) 999-99-99"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">О себе</Label>
              <Textarea
                id="bio"
                value={profileData.bio}
                onChange={(e) => setProfileData(prev => ({ ...prev, bio: e.target.value }))}
                placeholder="Расскажите о себе..."
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Конфиденциальность</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Номер телефона</Label>
                  <Select
                    value={privacySettings.show_phone}
                    onValueChange={(value) => setPrivacySettings(prev => ({
                      ...prev,
                      show_phone: value
                    }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Время последнего визита</Label>
                  <Select
                    value={privacySettings.show_last_seen}
                    onValueChange={(value) => setPrivacySettings(prev => ({
                      ...prev,
                      show_last_seen: value
                    }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Фото профиля</Label>
                  <Select
                    value={privacySettings.show_profile_photo}
                    onValueChange={(value) => setPrivacySettings(prev => ({
                      ...prev,
                      show_profile_photo: value
                    }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {privacyOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-4">Уведомления</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Звук</Label>
                  <Switch
                    checked={notificationSettings.sound}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      sound: checked
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Вибрация</Label>
                  <Switch
                    checked={notificationSettings.vibration}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      vibration: checked
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Предпросмотр сообщений</Label>
                  <Switch
                    checked={notificationSettings.preview}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      preview: checked
                    }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label>Уведомления групп</Label>
                  <Switch
                    checked={notificationSettings.group_notifications}
                    onCheckedChange={(checked) => setNotificationSettings(prev => ({
                      ...prev,
                      group_notifications: checked
                    }))}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={saveProfile} disabled={isLoading}>
            {isLoading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
