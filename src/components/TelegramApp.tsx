
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { AuthForm } from './AuthForm';
import { ChatList } from './ChatList';
import { ChatWindow } from './ChatWindow';
import { NewChatDialog } from './NewChatDialog';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function TelegramApp() {
  const { user, loading, signOut } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <div className="h-screen flex bg-gray-100">
      <ChatList
        onChatSelect={setSelectedChatId}
        selectedChatId={selectedChatId}
        onNewChat={() => setShowNewChatDialog(true)}
      />
      
      {selectedChatId ? (
        <ChatWindow chatId={selectedChatId} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
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
          
          <Button
            variant="outline"
            className="absolute top-4 right-4"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Выйти
          </Button>
        </div>
      )}

      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onChatCreated={(chatId) => {
          setSelectedChatId(chatId);
        }}
      />
    </div>
  );
}
