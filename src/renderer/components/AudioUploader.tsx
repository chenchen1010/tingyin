import React, { useCallback, useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { TranscriptionData } from '../../types/transcription';
const { ipcRenderer } = window.require('electron');

interface Props {
  onTranscriptionComplete: (result: TranscriptionData) => void;
  onProgressUpdate: (value: number) => void;
  onLogUpdate: (message: string) => void;
  onAudioFile: (url: string) => void;
  showLogs: boolean;
  onShowLogsChange: (show: boolean) => void;
}

export const AudioUploader: React.FC<Props> = ({
  onTranscriptionComplete,
  onProgressUpdate,
  onLogUpdate,
  onAudioFile,
  showLogs,
  onShowLogsChange
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [numSpeakers, setNumSpeakers] = useState<number>(2);
  const [modelSize, setModelSize] = useState<string>("small");

  const modelOptions = {
    tiny: {
      name: "tiny"
    },
    base: {
      name: "base"
    },
    small: {
      name: "small"
    },
    medium: {
      name: "medium"
    },
    large: {
      name: "large"
    }
  };

  const modelDescription = `Whisper 模型等级说明:
tiny: 39M参数, 内存占用 ~1GB, 10分钟音频处理时间约1分钟
    适用场景: 快速测试、资源受限设备、对准确率要求不高的场景

base: 74M参数, 内存占用 ~1.5GB, 10分钟音频处理时间约2分钟
    适用场景: 一般对话场景,准确率和性能较为均衡

small: 244M参数, 内存占用 ~2GB, 10分钟音频处理时间约4分钟
      适用场景: 推荐默认选择,准确率和性能平衡较好

medium: 769M参数, 内存占用 ~5GB, 10分钟音频处理时间约8分钟
      适用场景: 复杂场景、多人对话、背景噪音较大

large: 1550M参数, 内存占用 ~10GB, 10分钟音频处理时间约15分钟
      适用场景: 追求最高准确率、专业场景使用`


  const handleSegmentClick = (startTime: number) => {
    // 处理音频片段点击
    const audioElement = document.querySelector('audio');
    if (audioElement) {
      audioElement.currentTime = startTime;
      audioElement.play();
    }
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    console.log('文件拖放触发', acceptedFiles);
    
    try {
      const file = acceptedFiles[0];
      if (!file) {
        console.log('没有文件被选择');
        return;
      }

      // 创建音频预览 URL
      const audioUrl = URL.createObjectURL(file);
      onAudioFile(audioUrl);

      try {
        setIsProcessing(true);
        setError(null);
        onProgressUpdate(0);

        // 将文件内容转换为 Buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // 通过 IPC 在主进程中保存临时文件
        const tempPath = await ipcRenderer.invoke('save-temp-file', {
          buffer: Array.from(new Uint8Array(arrayBuffer)),
          filename: file.name
        });

        console.log('文件信息:', {
          name: file.name,
          tempPath: tempPath,
          size: file.size,
          type: file.type
        });

        // 开始转录，传入说话人数量
        const result = await ipcRenderer.invoke('transcribe-audio', tempPath, numSpeakers, modelSize);
        console.log('转录结果:', result);
        
        if (!result) {
          throw new Error('转录结果为空');
        }

        // 清理临时文件
        await ipcRenderer.invoke('delete-temp-file', tempPath);

        handleTranscriptionComplete(result);
        onProgressUpdate(100);
      } catch (error) {
        console.error('处理错误:', error);
        setError(error instanceof Error ? error.message : '转录失败，请重试');
      } finally {
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('上传错误:', error);
      setError(error instanceof Error ? error.message : '转录失败，请重试');
    }
  }, [onTranscriptionComplete, onProgressUpdate, onAudioFile, numSpeakers, modelSize]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac']
    },
    disabled: isProcessing,
    noClick: false,
    noKeyboard: false,
    multiple: false,
    useFsAccessApi: false,
  });

  console.log('Dropzone 状态:', { isDragActive, isProcessing });

  useEffect(() => {
    // 添加进度更新监听
    const progressHandler = (_, progress) => {
      console.log('收到进度更新:', progress);
      onProgressUpdate(progress);
    };

    ipcRenderer.on('transcription-progress', progressHandler);

    // 清理函数
    return () => {
      ipcRenderer.removeListener('transcription-progress', progressHandler);
    };
  }, [onProgressUpdate]);

  useEffect(() => {
    // 添加日志监听
    const logHandler = (_, message) => {
      console.log('收到日志:', message);
      onLogUpdate(message);
    };

    ipcRenderer.on('transcription-log', logHandler);

    return () => {
      ipcRenderer.removeListener('transcription-log', logHandler);
    };
  }, [onLogUpdate]);

  // 修改文件选择按钮的处理
  const handleFileSelect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mp3,.wav,.m4a,.aac';
    
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];
        await onDrop([file]);
      }
    };
    
    input.click();
  };

  const handleTranscriptionComplete = (result: string | TranscriptionData) => {
    try {
      const transcriptionData = typeof result === 'string' 
        ? JSON.parse(result) as TranscriptionData 
        : result;
      
      onTranscriptionComplete(transcriptionData);  // 只通知父组件
    } catch (error) {
      console.error('转录结果解析错误:', error);
      setError('转录结果格式错误，请重试');
    }
  };

  return (
    <div className="uploader-container">
      <div className="uploader-header">
        <div className="settings-group">
          <label>
            说话人数量：
            <select 
              value={numSpeakers} 
              onChange={(e) => setNumSpeakers(Number(e.target.value))}
              disabled={isProcessing}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>{num}</option>
              ))}
            </select>
          </label>
          <label className="model-select-container">
            模型选择：
            <select
              value={modelSize}
              onChange={(e) => setModelSize(e.target.value)}
              disabled={isProcessing}
            >
              {Object.entries(modelOptions).map(([key, value]) => (
                <option key={key} value={key}>{value.name}</option>
              ))}
            </select>
            <span 
              className="info-icon" 
              data-tooltip={modelDescription}
            >
              ⓘ
            </span>
          </label>
        </div>

        <div className="log-control">
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={showLogs}
              onChange={(e) => onShowLogsChange(e.target.checked)}
            />
            <span className="slider"></span>
            <span className="label">显示处理日志</span>
          </label>
        </div>
      </div>
      
      <div 
        {...getRootProps()} 
        className={`dropzone ${isDragActive ? 'active' : ''} ${isProcessing ? 'processing' : ''}`}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <p>正在处理音频文件...</p>
        ) : isDragActive ? (
          <p>拖放音频文件到这里...</p>
        ) : (
          <div>
            <p>拖放音频文件到这里，或点击选择文件</p>
            <button 
              type="button" 
              onClick={handleFileSelect}
              style={{
                padding: '8px 16px',
                margin: '10px 0',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              选择文件
            </button>
          </div>
        )}
      </div>
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}; 