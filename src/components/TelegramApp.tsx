
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { AuthForm } from '@/components/AuthForm';
import { ChatList } from '@/components/ChatList';
import { ChatWindow } from '@/components/ChatWindow';
import { ProfileSettings } from '@/components/ProfileSettings';

export function TelegramApp() {
  const { user, loading } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string>();
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  
  // Отслеживаем статус пользователя онлайн/оффлайн
  useOnlineStatus();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (showProfileSettings) {
    return (
      <ProfileSettings 
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
      />
    );
  }

  return (
    <div className="h-screen flex bg-background">
      <ChatList
        selectedChatId={selectedChatId}
        onChatSelect={setSelectedChatId}
        onProfileSettings={() => setShowProfileSettings(true)}
      />
      
      {selectedChatId ? (
        <ChatWindow chatId={selectedChatId} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <p className="text-lg">Выберите чат для начала общения</p>
          </div>
        </div>
      )}
    </div>
  );
}
