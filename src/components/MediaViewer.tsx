
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, X, Download } from 'lucide-react';

interface MediaViewerProps {
  url: string;
  type: 'image' | 'video';
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
}

export function MediaViewer({ url, type, isOpen, onClose, fileName }: MediaViewerProps) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.25));
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'file';
    link.click();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex space-x-2">
            {type === 'image' && (
              <>
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center justify-center p-4 bg-black">
            {type === 'image' ? (
              <img
                src={url}
                alt={fileName}
                style={{ transform: `scale(${zoom})` }}
                className="max-w-full max-h-[80vh] object-contain transition-transform"
              />
            ) : (
              <video
                src={url}
                controls
                className="max-w-full max-h-[80vh]"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
