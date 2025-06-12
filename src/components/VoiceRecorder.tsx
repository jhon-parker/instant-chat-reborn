
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Send, Trash2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onSend, onCancel }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        setAudioBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      intervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast({
        title: 'Ошибка',
        description: 'Не удалось получить доступ к микрофону',
        variant: 'destructive'
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSend(audioBlob);
      setAudioBlob(null);
      setRecordingTime(0);
    }
  };

  const handleCancel = () => {
    if (isRecording) {
      stopRecording();
    }
    setAudioBlob(null);
    setRecordingTime(0);
    onCancel();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center space-x-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
      {isRecording ? (
        <>
          <Button variant="destructive" size="sm" onClick={stopRecording}>
            <MicOff className="h-4 w-4" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-red-600 font-medium">Запись... {formatTime(recordingTime)}</div>
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            </div>
          </div>
        </>
      ) : audioBlob ? (
        <>
          <div className="flex-1 text-center">
            <div className="text-sm">Голосовое сообщение ({formatTime(recordingTime)})</div>
          </div>
          <Button variant="outline" size="sm" onClick={handleSend}>
            <Send className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button variant="outline" size="sm" onClick={startRecording}>
          <Mic className="h-4 w-4" />
          Записать голосовое
        </Button>
      )}
      
      <Button variant="ghost" size="sm" onClick={handleCancel}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
