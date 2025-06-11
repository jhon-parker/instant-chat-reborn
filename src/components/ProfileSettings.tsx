
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Save } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ProfileData {
  first_name: string;
  last_name: string;
  username: string;
  bio: string;
  phone: string;
  avatar_url: string;
  privacy_settings: {
    show_phone: string;
    show_last_seen: string;
    show_profile_photo: string;
    allow_calls: string;
    allow_groups: string;
  };
  notification_settings: {
    sound: boolean;
    vibration: boolean;
    preview: boolean;
    group_notifications: boolean;
  };
}

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileSettings({ open, onOpenChange }: ProfileSettingsProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    username: '',
    bio: '',
    phone: '',
    avatar_url: '',
    privacy_settings: {
      show_phone: 'everyone',
      show_last_seen: 'everyone',
      show_profile_photo: 'everyone',
      allow_calls: 'everyone',
      allow_groups: 'everyone'
    },
    notification_settings: {
      sound: true,
      vibration: true,
      preview: true,
      group_notifications: true
    }
  });

  useEffect(() => {
    if (open && user) {
      fetchProfile();
    }
  }, [open, user]);

  const fetchProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (data) {
      setProfile({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        username: data.username || '',
        bio: data.bio || '',
        phone: data.phone || '',
        avatar_url: data.avatar_url || '',
        privacy_settings: (data.privacy_settings as any) || profile.privacy_settings,
        notification_settings: (data.notification_settings as any) || profile.notification_settings
      });
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          username: profile.username,
          bio: profile.bio,
          phone: profile.phone,
          privacy_settings: profile.privacy_settings,
          notification_settings: profile.notification_settings
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({ title: 'Профиль обновлён!' });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Ошибка обновления профиля',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const privacyOptions = [
    { value: 'everyone', label: 'Все' },
    { value: 'contacts', label: 'Контакты' },
    { value: 'nobody', label: 'Никто' }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Настройки профиля</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex items-center space-x-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile.avatar_url} />
              <AvatarFallback>
                {profile.first_name?.[0]}{profile.last_name?.[0]}
              </AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">
              <Camera className="h-4 w-4 mr-2" />
              Изменить фото
            </Button>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">Имя</Label>
              <Input
                id="firstName"
                value={profile.first_name}
                onChange={(e) => setProfile(prev => ({ ...prev, first_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Фамилия</Label>
              <Input
                id="lastName"
                value={profile.last_name}
                onChange={(e) => setProfile(prev => ({ ...prev, last_name: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="username">Имя пользователя</Label>
            <Input
              id="username"
              value={profile.username}
              onChange={(e) => setProfile(prev => ({ ...prev, username: e.target.value }))}
              placeholder="@username"
            />
          </div>

          <div>
            <Label htmlFor="bio">О себе</Label>
            <Textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="Расскажите о себе..."
            />
          </div>

          <div>
            <Label htmlFor="phone">Телефон</Label>
            <Input
              id="phone"
              value={profile.phone}
              onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="+7 (xxx) xxx-xx-xx"
            />
          </div>

          {/* Privacy Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Конфиденциальность</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Номер телефона</Label>
                <Select
                  value={profile.privacy_settings.show_phone}
                  onValueChange={(value) => setProfile(prev => ({
                    ...prev,
                    privacy_settings: { ...prev.privacy_settings, show_phone: value }
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
                  value={profile.privacy_settings.show_last_seen}
                  onValueChange={(value) => setProfile(prev => ({
                    ...prev,
                    privacy_settings: { ...prev.privacy_settings, show_last_seen: value }
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
                  value={profile.privacy_settings.show_profile_photo}
                  onValueChange={(value) => setProfile(prev => ({
                    ...prev,
                    privacy_settings: { ...prev.privacy_settings, show_profile_photo: value }
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

          {/* Notification Settings */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Уведомления</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Звук</Label>
                <Switch
                  checked={profile.notification_settings.sound}
                  onCheckedChange={(checked) => setProfile(prev => ({
                    ...prev,
                    notification_settings: { ...prev.notification_settings, sound: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Вибрация</Label>
                <Switch
                  checked={profile.notification_settings.vibration}
                  onCheckedChange={(checked) => setProfile(prev => ({
                    ...prev,
                    notification_settings: { ...prev.notification_settings, vibration: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Предпросмотр сообщений</Label>
                <Switch
                  checked={profile.notification_settings.preview}
                  onCheckedChange={(checked) => setProfile(prev => ({
                    ...prev,
                    notification_settings: { ...prev.notification_settings, preview: checked }
                  }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Уведомления групп</Label>
                <Switch
                  checked={profile.notification_settings.group_notifications}
                  onCheckedChange={(checked) => setProfile(prev => ({
                    ...prev,
                    notification_settings: { ...prev.notification_settings, group_notifications: checked }
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
