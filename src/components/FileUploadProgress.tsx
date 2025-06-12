
import { Progress } from '@/components/ui/progress';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FileUploadProgressProps {
  files: Array<{
    id: string;
    name: string;
    progress: number;
    size: number;
  }>;
  onCancel: (fileId: string) => void;
}

export function FileUploadProgress({ files, onCancel }: FileUploadProgressProps) {
  if (files.length === 0) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-2 p-2 border-t bg-gray-50 dark:bg-gray-800">
      {files.map((file) => (
        <div key={file.id} className="flex items-center space-x-2">
          <div className="flex-1">
            <div className="flex items-center justify-between text-sm">
              <span className="truncate">{file.name}</span>
              <span className="text-gray-500">{formatFileSize(file.size)}</span>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <Progress value={file.progress} className="flex-1" />
              <span className="text-xs text-gray-500">{Math.round(file.progress)}%</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(file.id)}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
