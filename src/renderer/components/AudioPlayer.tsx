import React, { useState, useEffect, forwardRef, ForwardedRef } from 'react';

interface Props {
  audioUrl: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export const AudioPlayer = forwardRef<HTMLAudioElement, Props>(({ audioUrl, onTimeUpdate }, ref: ForwardedRef<HTMLAudioElement>) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);

  // 定义可选的播放速度
  const playbackRates = [
    { label: '0.5x', value: 0.5 },
    { label: '0.75x', value: 0.75 },
    { label: '1x', value: 1 },
    { label: '1.25x', value: 1.25 },
    { label: '1.5x', value: 1.5 },
    { label: '2x', value: 2 },
    { label: '3x', value: 3 }
  ];

  // 获取 audio 元素的辅助函数
  const getAudioElement = () => {
    return (ref as React.MutableRefObject<HTMLAudioElement | null>)?.current;
  };

  useEffect(() => {
    const audio = getAudioElement();
    if (audio) {
      audio.volume = volume;
      audio.playbackRate = playbackRate;
    }
  }, [volume, playbackRate]);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleTimeUpdate = () => {
    const audio = getAudioElement();
    if (audio) {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = getAudioElement();
    if (audio) {
      setDuration(audio.duration);
    }
  };

  const togglePlay = () => {
    const audio = getAudioElement();
    if (audio) {
      if (isPlaying) {
        audio.pause();
      } else {
        audio.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    const audio = getAudioElement();
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  };

  const skip = (seconds: number) => {
    const audio = getAudioElement();
    if (audio) {
      audio.currentTime = Math.min(
        Math.max(audio.currentTime + seconds, 0),
        audio.duration
      );
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setVolume(value);
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRate = parseFloat(e.target.value);
    setPlaybackRate(newRate);
    const audio = getAudioElement();
    if (audio) {
      audio.playbackRate = newRate;
    }
  };

  return (
    <div className="audio-player">
      <audio
        ref={ref}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      
      <div className="controls-container">
        <div className="main-controls">
          <div className="left-controls">
            <button onClick={() => skip(-15)} className="skip-button">
              -15s
            </button>
            <button onClick={togglePlay} className="play-button">
              {isPlaying ? '暂停' : '播放'}
            </button>
            <button onClick={() => skip(15)} className="skip-button">
              +15s
            </button>
          </div>

          <div className="right-controls">
            <div className="volume-control">
              <span className="volume-icon">🔊</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={volume}
                onChange={handleVolumeChange}
                className="volume-slider"
              />
            </div>

            <div className="playback-control">
              <select
                value={playbackRate}
                onChange={handleRateChange}
                className="rate-select"
              >
                {playbackRates.map(rate => (
                  <option key={rate.value} value={rate.value}>
                    {rate.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="time-control">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration}
            value={currentTime}
            onChange={handleSeek}
            className="progress-slider"
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}); 