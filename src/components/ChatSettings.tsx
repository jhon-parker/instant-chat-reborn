
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Upload, X } from 'lucide-react';

interface ChatSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chat: {
    id: string;
    name: string;
    description?: string;
    avatar_url?: string;
    wallpaper_url?: string;
    is_group: boolean;
    chat_type: string;
  };
  onUpdate: () => void;
}

export function ChatSettings({ open, onOpenChange, chat, onUpdate }: ChatSettingsProps) {
  const [name, setName] = useState(chat.name || '');
  const [description, setDescription] = useState(chat.description || '');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${chat.id}.${fileExt}`;
      const filePath = `chat-avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('chats')
        .update({ avatar_url: data.publicUrl })
        .eq('id', chat.id);

      if (updateError) throw updateError;

      toast({ title: 'Аватар обновлен' });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsLoading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${chat.id}-${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-wallpapers')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('chat-wallpapers')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('chats')
        .update({ wallpaper_url: data.publicUrl })
        .eq('id', chat.id);

      if (updateError) throw updateError;

      toast({ title: 'Обои установлены' });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка загрузки',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveWallpaper = async () => {
    try {
      const { error } = await supabase
        .from('chats')
        .update({ wallpaper_url: null })
        .eq('id', chat.id);

      if (error) throw error;

      toast({ title: 'Обои удалены' });
      onUpdate();
    } catch (error: any) {
      toast({
        title: 'Ошибка',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('chats')
        .update({ 
          name: name.trim(),
          description: description.trim() || null
        })
        .eq('id', chat.id);

      if (error) throw error;

      toast({ title: 'Настройки сохранены' });
      onUpdate();
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Настройки чата</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="avatar">Аватар чата</Label>
            <div className="flex items-center space-x-2 mt-1">
              <input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('avatar')?.click()}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Загрузить аватар
              </Button>
            </div>
          </div>

          <div>
            <Label htmlFor="name">Название чата</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название"
            />
          </div>

          {chat.is_group && (
            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Введите описание группы"
                rows={3}
              />
            </div>
          )}

          <div>
            <Label>Обои чата</Label>
            <div className="flex items-center space-x-2 mt-1">
              <input
                id="wallpaper"
                type="file"
                accept="image/*"
                onChange={handleWallpaperUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => document.getElementById('wallpaper')?.click()}
                disabled={isLoading}
              >
                <Upload className="h-4 w-4 mr-2" />
                Установить обои
              </Button>
              {chat.wallpaper_url && (
                <Button
                  variant="outline"
                  onClick={handleRemoveWallpaper}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Убрать обои
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              Сохранить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
