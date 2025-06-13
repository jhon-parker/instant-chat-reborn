
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useOnlineStatus() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Устанавливаем статус "онлайн" при входе
    const setOnline = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ 
            is_online: true,
            last_seen: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error setting online status:', error);
      }
    };

    // Устанавливаем статус "оффлайн" при выходе
    const setOffline = async () => {
      try {
        await supabase
          .from('profiles')
          .update({ 
            is_online: false,
            last_seen: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error setting offline status:', error);
      }
    };

    setOnline();

    // Обработчики событий
    const handleBeforeUnload = () => {
      setOffline();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setOnline();
      } else {
        setOffline();
      }
    };

    // Устанавливаем слушатели
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Периодически обновляем статус
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setOnline();
      }
    }, 30000); // каждые 30 секунд

    return () => {
      setOffline();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(intervalId);
    };
  }, [user]);
}
