import React, { useState, useRef } from 'react';
import { AudioUploader } from './components/AudioUploader';
import { TranscriptionViewer } from './components/TranscriptionViewer';
import { ProgressBar } from './components/ProgressBar';
import { LogViewer } from './components/LogViewer';
import { AudioPlayer } from './components/AudioPlayer';
import { TranscriptionData } from '../types/transcription';

const App: React.FC = () => {
  const [transcription, setTranscription] = useState<TranscriptionData | null>(null);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const handleProgressUpdate = (value: number) => {
    setProgress(value);
  };

  const handleLogUpdate = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  const handleAudioFile = (url: string) => {
    setAudioUrl(url);
  };

  const handleShowLogsChange = (show: boolean) => {
    setShowLogs(show);
  };

  const handleSegmentClick = (startTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = startTime;
    }
  };

  return (
    <div className="app">
      <header>
        <h1>音频转录</h1>
      </header>
      
      <main>
        <AudioUploader 
          onTranscriptionComplete={(result) => setTranscription(result)}
          onProgressUpdate={setProgress}
          onLogUpdate={handleLogUpdate}
          onAudioFile={setAudioUrl}
          showLogs={showLogs}
          onShowLogsChange={setShowLogs}
        />
        {audioUrl && (
          <AudioPlayer 
            audioUrl={audioUrl} 
            ref={audioRef}
            onTimeUpdate={setCurrentTime}
          />
        )}
        <ProgressBar progress={progress} />
        {showLogs && logs.length > 0 && <LogViewer logs={logs} />}
        {transcription && (
          <TranscriptionViewer 
            content={transcription}
            onEdit={(newContent) => setTranscription(JSON.parse(newContent))}
            onSegmentClick={handleSegmentClick}
            currentTime={currentTime}
          />
        )}
      </main>
    </div>
  );
};

export default App; 