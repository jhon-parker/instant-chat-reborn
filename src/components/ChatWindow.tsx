
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Phone, Video, MoreVertical, Paperclip, Image, ArrowLeft, Settings, Mic } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { MessageContextMenu } from './MessageContextMenu';
import { MediaViewer } from './MediaViewer';
import { AudioPlayer } from './AudioPlayer';
import { VoiceRecorder } from './VoiceRecorder';
import { FileUploadProgress } from './FileUploadProgress';
import { ChatSettings } from './ChatSettings';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: string;
  file_url?: string;
  file_name?: string;
  formatted_content?: any;
  profiles: {
    first_name: string;
    last_name: string;
    avatar_url: string | null;
  };
}

interface Chat {
  id: string;
  name: string;
  avatar_url: string | null;
  is_group: boolean;
  chat_type: string;
  wallpaper_url?: string;
  description?: string;
}

interface ChatWindowProps {
  chatId: string;
  onBackToList?: () => void;
}

interface UploadingFile {
  id: string;
  name: string;
  progress: number;
  size: number;
}

export function ChatWindow({ chatId, onBackToList }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [mediaViewer, setMediaViewer] = useState<{
    url: string;
    type: 'image' | 'video';
    fileName?: string;
  } | null>(null);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    fetchChat();
    fetchMessages();

    const messagesSubscription = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('New message received:', payload);
        fetchMessages();
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesSubscription);
    };
  }, [chatId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchChat = async () => {
    const { data } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .single();

    if (data) {
      setChat(data);
    }
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select(`
        *,
        profiles (
          first_name,
          last_name,
          avatar_url
        )
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const uploadFile = async (file: File): Promise<{ url: string; fileName: string }> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    // Создаем запись в uploadingFiles для прогресс-бара
    const uploadId = Math.random().toString();
    setUploadingFiles(prev => [...prev, {
      id: uploadId,
      name: file.name,
      progress: 0,
      size: file.size
    }]);

    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(filePath, file);

    if (uploadError) {
      setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
      throw uploadError;
    }

    // Обновляем прогресс
    setUploadingFiles(prev => prev.map(f => 
      f.id === uploadId ? { ...f, progress: 100 } : f
    ));

    const { data } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath);

    // Удаляем из списка загружающихся файлов
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.id !== uploadId));
    }, 1000);

    return { url: data.publicUrl, fileName: file.name };
  };

  const uploadVoiceMessage = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const fileName = `voice_${Date.now()}.ogg`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      await sendMessage(null, data.publicUrl, fileName, 'voice');
      setShowVoiceRecorder(false);
    } catch (error: any) {
      toast({
        title: 'Ошибка отправки голосового сообщения',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (
    content: string | null = newMessage.trim(),
    fileUrl: string | null = null,
    fileName: string | null = null,
    messageType: string = 'text'
  ) => {
    if ((!content && !fileUrl && selectedFiles.length === 0) || !user || isLoading) return;

    setIsLoading(true);
    
    try {
      // Загружаем выбранные файлы
      for (const file of selectedFiles) {
        const { url, fileName: uploadedFileName } = await uploadFile(file);
        const type = file.type.startsWith('image/') ? 'image' : 
                    file.type.startsWith('video/') ? 'video' :
                    file.type.startsWith('audio/') ? 'audio' : 'file';

        const { error } = await supabase
          .from('messages')
          .insert({
            content: content || null,
            chat_id: chatId,
            sender_id: user.id,
            message_type: type,
            file_url: url,
            file_name: uploadedFileName
          });

        if (error) throw error;
      }

      // Отправляем основное сообщение если есть контент или один файл
      if (content || fileUrl) {
        const { error } = await supabase
          .from('messages')
          .insert({
            content,
            chat_id: chatId,
            sender_id: user.id,
            message_type: messageType,
            file_url: fileUrl,
            file_name: fileName
          });

        if (error) throw error;
      }

      // Обновляем время последнего обновления чата
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

      setNewMessage('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      toast({
        title: 'Ошибка отправки сообщения',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleMediaClick = (url: string, type: 'image' | 'video', fileName?: string) => {
    setMediaViewer({ url, type, fileName });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?';
  };

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.sender_id === user?.id;
    
    return (
      <MessageContextMenu
        key={message.id}
        message={{
          id: message.id,
          content: message.content,
          sender_id: message.sender_id,
          is_own: isOwnMessage
        }}
        onReply={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onPin={() => {}}
        onSave={() => {}}
      >
        <div className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
          <div className={`flex items-end space-x-2 max-w-xs lg:max-w-md ${
            isOwnMessage ? 'flex-row-reverse space-x-reverse' : ''
          }`}>
            {!isOwnMessage && (
              <Avatar className="w-6 h-6">
                <AvatarImage src={message.profiles?.avatar_url || ''} />
                <AvatarFallback className="text-xs">
                  {getInitials(message.profiles?.first_name, message.profiles?.last_name)}
                </AvatarFallback>
              </Avatar>
            )}
            
            <div className={`px-3 py-2 rounded-lg ${
              isOwnMessage 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-muted text-muted-foreground'
            }`}>
              {message.message_type === 'image' && message.file_url && (
                <img 
                  src={message.file_url} 
                  alt={message.file_name || 'Image'} 
                  className="max-w-xs rounded mb-2 cursor-pointer"
                  onClick={() => handleMediaClick(message.file_url!, 'image', message.file_name)}
                />
              )}

              {message.message_type === 'video' && message.file_url && (
                <video 
                  src={message.file_url} 
                  className="max-w-xs rounded mb-2 cursor-pointer"
                  onClick={() => handleMediaClick(message.file_url!, 'video', message.file_name)}
                  controls={false}
                />
              )}

              {(message.message_type === 'audio' || message.message_type === 'voice') && message.file_url && (
                <div className="mb-2">
                  <AudioPlayer url={message.file_url} fileName={message.file_name} />
                </div>
              )}
              
              {message.message_type === 'file' && message.file_url && (
                <div className="mb-2">
                  <a 
                    href={message.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center space-x-2 text-primary hover:text-primary/80"
                  >
                    <Paperclip className="h-4 w-4" />
                    <span>{message.file_name || 'Файл'}</span>
                  </a>
                </div>
              )}
              
              {message.content && (
                <p className="text-sm">{message.content}</p>
              )}
              
              <p className={`text-xs mt-1 ${
                isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
              }`}>
                {formatTime(message.created_at)}
              </p>
            </div>
          </div>
        </div>
      </MessageContextMenu>
    );
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-muted-foreground">Загрузка чата...</p>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col"
      style={{
        backgroundImage: chat.wallpaper_url ? `url(${chat.wallpaper_url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      {/* Chat Header */}
      <div className="p-4 border-b bg-card/95 backdrop-blur flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {onBackToList && (
            <Button variant="ghost" size="sm" onClick={onBackToList}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <Avatar>
            <AvatarImage src={chat.avatar_url || ''} />
            <AvatarFallback>{chat.name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{chat.name}</h3>
            <p className="text-xs text-muted-foreground">
              {chat.is_group ? 'Группа' : 'В сети'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">
            <Video className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowChatSettings(true)}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map(renderMessage)}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* File Upload Progress */}
      <FileUploadProgress 
        files={uploadingFiles}
        onCancel={(fileId) => {
          setUploadingFiles(prev => prev.filter(f => f.id !== fileId));
        }}
      />

      {/* Voice Recorder */}
      {showVoiceRecorder && (
        <VoiceRecorder
          onSend={uploadVoiceMessage}
          onCancel={() => setShowVoiceRecorder(false)}
        />
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="p-2 border-t bg-card/95 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center space-x-2 bg-muted p-2 rounded">
                <span className="text-sm truncate max-w-32">{file.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                  className="h-6 w-6 p-0"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 border-t bg-card/95 backdrop-blur">
        <form onSubmit={handleFormSubmit} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            multiple
          />
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*";
                fileInputRef.current.click();
              }
            }}
          >
            <Image className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowVoiceRecorder(true)}
          >
            <Mic className="h-4 w-4" />
          </Button>
          
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Напишите сообщение..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || isLoading}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Media Viewer */}
      {mediaViewer && (
        <MediaViewer
          url={mediaViewer.url}
          type={mediaViewer.type}
          fileName={mediaViewer.fileName}
          isOpen={!!mediaViewer}
          onClose={() => setMediaViewer(null)}
        />
      )}

      {/* Chat Settings */}
      {showChatSettings && (
        <ChatSettings
          open={showChatSettings}
          onOpenChange={setShowChatSettings}
          chat={chat}
          onUpdate={fetchChat}
        />
      )}
    </div>
  );
}
