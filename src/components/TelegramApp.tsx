
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { AuthForm } from './AuthForm';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { NewChatDialog } from './NewChatDialog';
import { ProfileSettings } from './ProfileSettings';
import { NotificationCenter } from './NotificationCenter';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Moon, Sun } from 'lucide-react';

export function TelegramApp() {
  const { user, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
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

  return (
    <div className="h-screen flex bg-background w-full">
      <ChatList
        onChatSelect={setSelectedChatId}
        selectedChatId={selectedChatId}
        onProfileSettings={() => setShowProfileSettings(true)}
      />
      
      {selectedChatId ? (
        <ChatWindow 
          chatId={selectedChatId} 
          onBackToList={() => setSelectedChatId(null)}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-2">Выберите чат</h3>
            <p>Выберите чат из списка или создайте новый</p>
            <Button 
              className="mt-4" 
              onClick={() => setShowNewChatDialog(true)}
            >
              Создать новый чат
            </Button>
          </div>
          
          <div className="absolute top-4 right-4 flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowProfileSettings(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Настройки
            </Button>
            
            <NotificationCenter
              open={showNotifications}
              onOpenChange={setShowNotifications}
            />
            
            <Button
              variant="outline"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>
        </div>
      )}

      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onChatCreated={(chatId) => {
          setSelectedChatId(chatId);
        }}
      />

      <ProfileSettings
        open={showProfileSettings}
        onOpenChange={setShowProfileSettings}
      />
    </div>
  );
}
