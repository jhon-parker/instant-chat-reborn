
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator
} from '@/components/ui/context-menu';
import { Copy, Reply, Edit, Trash2, Pin, Save } from 'lucide-react';

interface MessageContextMenuProps {
  children: React.ReactNode;
  message: {
    id: string;
    content: string;
    sender_id: string;
    is_own: boolean;
  };
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPin: () => void;
  onSave: () => void;
}

export function MessageContextMenu({ 
  children, 
  message, 
  onReply, 
  onEdit, 
  onDelete,
  onPin,
  onSave 
}: MessageContextMenuProps) {
  const handleCopy = () => {
    if (message.content) {
      navigator.clipboard.writeText(message.content);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem onClick={onReply}>
          <Reply className="mr-2 h-4 w-4" />
          Ответить
        </ContextMenuItem>
        
        <ContextMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Копировать текст
        </ContextMenuItem>

        <ContextMenuItem onClick={onPin}>
          <Pin className="mr-2 h-4 w-4" />
          Закрепить
        </ContextMenuItem>

        <ContextMenuItem onClick={onSave}>
          <Save className="mr-2 h-4 w-4" />
          Сохранить в избранное
        </ContextMenuItem>

        <ContextMenuSeparator />

        {message.is_own && (
          <>
            <ContextMenuItem onClick={onEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Редактировать
            </ContextMenuItem>
            <ContextMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="mr-2 h-4 w-4" />
              Удалить
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
