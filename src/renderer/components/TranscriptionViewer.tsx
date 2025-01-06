import React, { useState, useCallback, useEffect } from 'react';
import { TranscriptionData } from '../../types/transcription';
const { ipcRenderer } = window.require('electron');

interface Segment {
  text: string;
  start: number;
  end: number;
}

interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  segments: Segment[];
}

interface EditHistory {
  content: TranscriptionData;
  timestamp: number;
}

interface Props {
  content: TranscriptionData;
  onEdit: (text: string) => void;
  onSegmentClick?: (startTime: number) => void;
}

export const TranscriptionViewer: React.FC<Props> = ({ 
  content, 
  onEdit,
  onSegmentClick 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editingContent, setEditingContent] = useState<string | TranscriptionData>(content);
  const [history, setHistory] = useState<EditHistory[]>([{ content, timestamp: Date.now() }]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // 当 content 改变时更新编辑内容和历史记录
  useEffect(() => {
    setEditingContent(content);
    setHistory([{ content, timestamp: Date.now() }]);
    setCurrentIndex(0);
  }, [content]);

  // 将 TranscriptionData 转换为可编辑的文本
  const transcriptionDataToText = (data: TranscriptionData): string => {
    return data.segments
      .map(speaker => 
        `${speaker.speakerId} [${formatTime(speaker.startTime)}]\n${
          speaker.segments.map(seg => seg.text).join('\n')
        }`
      )
      .join('\n\n');
  };

  // 将编辑后的文本转换回 TranscriptionData
  const textToTranscriptionData = (text: string): TranscriptionData => {
    const lines = text.split('\n');
    const segments: SpeakerSegment[] = [];
    let currentSpeaker: Partial<SpeakerSegment> = {};
    let currentSegments: Segment[] = [];

    lines.forEach(line => {
      if (!line.trim()) return;

      const speakerMatch = line.match(/^(说话人\d+)\s*\[(\d+:\d+)\]/);
      if (speakerMatch) {
        // 保存前一个说话人的片段
        if (currentSpeaker.speakerId && currentSegments.length > 0) {
          segments.push({
            speakerId: currentSpeaker.speakerId,
            startTime: currentSpeaker.startTime || 0,
            segments: [...currentSegments]
          });
        }

        // 解析新说话人信息
        const [, speakerId, timeStr] = speakerMatch;
        const [minutes, seconds] = timeStr.split(':').map(Number);
        currentSpeaker = {
          speakerId,
          startTime: minutes * 60 + seconds
        };
        currentSegments = [];
      } else if (line.trim() && currentSpeaker.speakerId) {
        // 添加文本片段
        currentSegments.push({
          text: line.trim(),
          start: currentSpeaker.startTime || 0,
          end: (currentSpeaker.startTime || 0) + line.length * 0.1 // 估算结束时间
        });
      }
    });

    // 添加最后一个说话人的片段
    if (currentSpeaker.speakerId && currentSegments.length > 0) {
      segments.push({
        speakerId: currentSpeaker.speakerId,
        startTime: currentSpeaker.startTime || 0,
        segments: currentSegments
      });
    }

    return { segments };
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newTranscriptionData = textToTranscriptionData(newText);
    handleEdit(newTranscriptionData);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const handleSegmentClick = (startTime: number) => {
    if (!isEditing && onSegmentClick) {
      onSegmentClick(startTime);
    }
  };

  const renderSegment = (segment: Segment, speakerId: string) => {
    const editableRef = React.useRef<HTMLSpanElement>(null);
    const selectionRef = React.useRef<{ start: number; end: number } | null>(null);
    const isComposingRef = React.useRef(false);

    const saveSelection = () => {
      const selection = window.getSelection();
      const range = selection?.getRangeAt(0);
      if (selection && range && editableRef.current) {
        selectionRef.current = {
          start: range.startOffset,
          end: range.endOffset
        };
      }
    };

    const restoreSelection = () => {
      if (!editableRef.current || !selectionRef.current) return;
      
      // 使用 requestAnimationFrame 确保在 DOM 更新后再设置光标
      requestAnimationFrame(() => {
        try {
          const textNode = editableRef.current!.firstChild || editableRef.current!;
          const length = textNode.textContent?.length || 0;
          const { start, end } = selectionRef.current!;
          const safeStart = Math.min(start, length);
          const safeEnd = Math.min(end, length);

          const selection = window.getSelection();
          const range = document.createRange();
          range.setStart(textNode, safeStart);
          range.setEnd(textNode, safeEnd);
          selection?.removeAllRanges();
          selection?.addRange(range);
        } catch (e) {
          console.error('恢复光标位置失败:', e);
        }
      });
    };

    return (
      <span 
        key={segment.start} 
        className="text-segment-container"
      >
        {isEditing ? (
          <span
            ref={editableRef}
            className="text-segment editable"
            contentEditable
            suppressContentEditableWarning
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={(e) => {
              isComposingRef.current = false;
              saveSelection();  // 先保存当前光标位置
              handleSegmentTextChange(
                speakerId,
                segment.start,
                e.currentTarget.textContent || '',
                false
              );
              requestAnimationFrame(() => {
                restoreSelection();  // 使用 requestAnimationFrame 确保在更新后恢复光标
              });
            }}
            onInput={(e) => {
              if (!isComposingRef.current) {
                saveSelection();
                handleSegmentTextChange(
                  speakerId,
                  segment.start,
                  e.currentTarget.textContent || '',
                  true
                );
                requestAnimationFrame(() => {
                  restoreSelection();
                });
              }
            }}
            onBlur={(e) => {
              if (!isComposingRef.current) {
                handleSegmentTextChange(
                  speakerId,
                  segment.start,
                  e.currentTarget.textContent || '',
                  false
                );
              }
              selectionRef.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              saveSelection();
            }}
          >
            {segment.text}
          </span>
        ) : (
          <span 
            className="text-segment"
            onClick={() => handleSegmentClick(segment.start)}
          >
            {segment.text}
          </span>
        )}
        {' '}
      </span>
    );
  };

  const handleSegmentTextChange = (
    speakerId: string, 
    segmentStart: number, 
    newText: string,
    isInputting: boolean = false  // 新增参数，标识是否正在输入
  ) => {
    if (typeof editingContent !== 'string' && isEditing) {
      const newContent = {
        segments: editingContent.segments.map(speaker => {
          if (speaker.speakerId === speakerId) {
            return {
              ...speaker,
              segments: speaker.segments.map(seg => 
                seg.start === segmentStart 
                  ? { ...seg, text: newText }
                  : seg
              )
            };
          }
          return speaker;
        })
      };

      // 更新编辑内容
      setEditingContent(newContent);
      
      // 如果不是正在输入状态，则记录历史
      if (!isInputting) {
        const newHistory = [
          ...history.slice(0, currentIndex + 1),
          { content: newContent, timestamp: Date.now() }
        ];
        setHistory(newHistory);
        setCurrentIndex(newHistory.length - 1);
      }

      // 通知父组件
      onEdit(JSON.stringify(newContent));
    }
  };

  const renderContent = () => {
    return (
      <div className="viewer">
        {content.segments.map((speakerSegment, index) => (
          <div key={index} className="speaker-section">
            <div className="speaker-label">
              {speakerSegment.speakerId} [{formatTime(speakerSegment.startTime)}]
            </div>
            <div className="speaker-content">
              {speakerSegment.segments.map(segment => 
                renderSegment(segment, speakerSegment.speakerId)
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleEdit = useCallback((newContent: TranscriptionData) => {
    if (isEditing) {
      const newHistory = [
        ...history.slice(0, currentIndex + 1),
        { content: newContent, timestamp: Date.now() }
      ];
      setHistory(newHistory);
      setCurrentIndex(newHistory.length - 1);
      setEditingContent(newContent);
      onEdit(JSON.stringify(newContent));
    }
  }, [history, currentIndex, onEdit, isEditing]);

  const handleUndo = useCallback(() => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      const previousContent = history[newIndex].content;
      setCurrentIndex(newIndex);
      setEditingContent(previousContent);
      onEdit(JSON.stringify(previousContent));
    }
  }, [currentIndex, history, onEdit]);

  const handleRedo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      const newIndex = currentIndex + 1;
      const nextContent = history[newIndex].content;
      setCurrentIndex(newIndex);
      setEditingContent(nextContent);
      onEdit(JSON.stringify(nextContent));
    }
  }, [currentIndex, history, onEdit]);

  const handleExport = async () => {
    try {
      // 将转录内容格式化为纯文本
      const formattedText = content.segments
        .map(speaker => 
          `${speaker.speakerId} [${formatTime(speaker.startTime)}]\n${
            speaker.segments.map(seg => seg.text).join('\n')
          }`
        )
        .join('\n\n');

      const success = await ipcRenderer.invoke('export-result', formattedText);
      if (success) {
        alert('导出成功！');
      }
    } catch (error: unknown) {
      console.error('导出失败:', error);
      const errorMessage = error instanceof Error 
        ? error.message 
        : '未知错误';
      alert('导出失败: ' + errorMessage);
    }
  };

  const toggleEdit = () => {
    if (isEditing) {
      const finalContent = typeof editingContent === 'string' 
        ? JSON.parse(editingContent)
        : editingContent;
      onEdit(JSON.stringify(finalContent));
      setIsEditing(false);
    } else {
      setIsEditing(true);
    }
  };

  return (
    <div className="transcription-viewer">
      <div className="header">
        <h2>转录结果</h2>
        <div className="header-controls">
          <button 
            onClick={toggleEdit} 
            className={`edit-button ${isEditing ? 'active' : ''}`}
          >
            {isEditing ? '完成' : '编辑'}
          </button>
          <button onClick={handleExport} className="export-button">
            导出结果
          </button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}; 