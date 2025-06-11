
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Phone, Video, MoreVertical, Paperclip, Image } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  message_type: string;
  file_url?: string;
  file_name?: string;
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
}

interface ChatWindowProps {
  chatId: string;
}

export function ChatWindow({ chatId }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chat, setChat] = useState<Chat | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chatId || !user) return;

    fetchChat();
    fetchMessages();

    // Subscribe to new messages with more specific filtering
    const messagesSubscription = supabase
      .channel(`chat_${chatId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('New message received:', payload);
        // Add the new message immediately to the state
        fetchMessages(); // Refetch to get complete data with profile info
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `chat_id=eq.${chatId}`
      }, (payload) => {
        console.log('Message updated:', payload);
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
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file: File) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `chat-files/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('chat-files')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('chat-files')
      .getPublicUrl(filePath);

    return { url: data.publicUrl, fileName: file.name };
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!newMessage.trim() && !selectedFile) || !user || isLoading) return;

    setIsLoading(true);
    
    try {
      let fileUrl = null;
      let fileName = null;
      let messageType = 'text';

      if (selectedFile) {
        const { url, fileName: uploadedFileName } = await uploadFile(selectedFile);
        fileUrl = url;
        fileName = uploadedFileName;
        messageType = selectedFile.type.startsWith('image/') ? 'image' : 'file';
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content: newMessage.trim() || null,
          chat_id: chatId,
          sender_id: user.id,
          message_type: messageType,
          file_url: fileUrl,
          file_name: fileName
        });

      if (error) throw error;

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Update chat's updated_at
      await supabase
        .from('chats')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', chatId);

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
      <div
        key={message.id}
        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
      >
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
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 text-gray-900'
          }`}>
            {message.message_type === 'image' && message.file_url && (
              <img 
                src={message.file_url} 
                alt={message.file_name || 'Image'} 
                className="max-w-xs rounded mb-2"
              />
            )}
            
            {message.message_type === 'file' && message.file_url && (
              <div className="mb-2">
                <a 
                  href={message.file_url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
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
              isOwnMessage ? 'text-blue-100' : 'text-gray-500'
            }`}>
              {formatTime(message.created_at)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  if (!chat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">Загрузка чата...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat Header */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={chat.avatar_url || ''} />
            <AvatarFallback>{chat.name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold">{chat.name}</h3>
            <p className="text-xs text-gray-500">
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
          <Button variant="ghost" size="sm">
            <MoreVertical className="h-4 w-4" />
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

      {/* Message Input */}
      <div className="p-4 border-t bg-white">
        {selectedFile && (
          <div className="mb-2 p-2 bg-gray-100 rounded flex items-center justify-between">
            <span className="text-sm">{selectedFile.name}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              ×
            </Button>
          </div>
        )}
        
        <form onSubmit={sendMessage} className="flex items-center space-x-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
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
          
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Напишите сообщение..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button type="submit" disabled={(!newMessage.trim() && !selectedFile) || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
