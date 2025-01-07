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
  const [editingContent, setEditingContent] = useState<TranscriptionData>(content);
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [originalSpeakerId, setOriginalSpeakerId] = useState<string>('');
  const [newSpeakerInput, setNewSpeakerInput] = useState('');
  const [showSpeakerEdit, setShowSpeakerEdit] = useState<number | null>(null);
  const [modifyAll, setModifyAll] = useState(false);
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

  const renderSpeakerLabel = (speakerId: string, startTime: number, index: number) => {
    const isEditing = editingSpeakerId === `${speakerId}-${index}` || editingSpeakerId === `new-${index}`;
    const editableRef = React.useRef<HTMLSpanElement>(null);
    const selectRef = React.useRef<HTMLSelectElement>(null);
    
    if (isEditing) {
      const existingSpeakers = Array.from(
        new Set(editingContent.segments.map(s => s.speakerId))
      );

      const currentValue = editingSpeakerId?.startsWith('new-') ? 'new' : speakerId;

      const modifyAllCheckbox = (
        <label className="modify-all-checkbox">
          <input
            type="checkbox"
            checked={modifyAll}
            onChange={(e) => setModifyAll(e.target.checked)}
          />
          <span>修改所有"{originalSpeakerId}"</span>
        </label>
      );

      if (currentValue === 'new') {
        return (
          <div className="speaker-edit">
            <span
              ref={editableRef}
              className="speaker-label-editable empty"
              contentEditable
              suppressContentEditableWarning
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const newSpeakerId = e.currentTarget.textContent?.trim();
                  if (newSpeakerId) {
                    const newContent = {
                      ...editingContent,
                      segments: editingContent.segments.map((segment, i) => 
                        (i === index || (modifyAll && segment.speakerId === originalSpeakerId))
                          ? { ...segment, speakerId: newSpeakerId }
                          : segment
                      )
                    };
                    setEditingContent(newContent);
                    onEdit(JSON.stringify(newContent));
                    setEditingSpeakerId(null);
                  }
                } else if (e.key === 'Escape') {
                  setEditingSpeakerId(null);
                }
              }}
              onInput={(e) => {
                if (e.currentTarget.textContent?.trim()) {
                  e.currentTarget.classList.remove('empty');
                } else {
                  e.currentTarget.classList.add('empty');
                }
              }}
              data-placeholder="新增说话人，按Enter键确认"
            />
            <time>[{formatTime(startTime)}]</time>
            {modifyAllCheckbox}
          </div>
        );
      }

      return (
        <div className="speaker-edit">
          <select
            ref={selectRef}
            value={currentValue}
            onChange={(e) => {
              const newSpeakerId = e.target.value;
              handleSpeakerChange(index, newSpeakerId, modifyAll, originalSpeakerId);
              e.currentTarget.size = 0;
            }}
            onBlur={(e) => {
              const target = e.relatedTarget;
              if (!target || !target.closest('.modify-all-checkbox')) {
                if (currentValue !== 'new') {
                  setEditingSpeakerId(null);
                  selectRef.current!.size = 0;
                }
              }
            }}
          >
            <option value="new">+ 新增说话人</option>
            {existingSpeakers.map(speaker => (
              <option key={speaker} value={speaker}>{speaker}</option>
            ))}
          </select>
          <time>[{formatTime(startTime)}]</time>
          {modifyAllCheckbox}
        </div>
      );
    }

    return (
      <div 
        className="speaker-label"
        onMouseEnter={() => setShowSpeakerEdit(index)}
        onMouseLeave={() => setShowSpeakerEdit(null)}
      >
        <span>{speakerId}</span>
        {showSpeakerEdit === index && (
          <button
            className="edit-speaker-button"
            onClick={(e) => {
              e.stopPropagation();
              setOriginalSpeakerId(editingContent.segments[index].speakerId);
              setEditingSpeakerId(`${speakerId}-${index}`);
              setModifyAll(false);
            }}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm.176 4.823L9.75 4.81l-6.286 6.287a.253.253 0 00-.064.108l-.558 1.953 1.953-.558a.253.253 0 00.108-.064l6.286-6.286z" />
            </svg>
          </button>
        )}
        <time>[{formatTime(startTime)}]</time>
      </div>
    );
  };

  const handleSpeakerChange = (
    index: number, 
    newSpeakerId: string, 
    modifyAll: boolean, 
    currentSpeakerId: string
  ) => {
    if (newSpeakerId === 'new') {
      setNewSpeakerInput('');
      setOriginalSpeakerId(editingContent.segments[index].speakerId);
      setEditingSpeakerId(`new-${index}`);
      
      const newContent = {
        ...editingContent,
        segments: editingContent.segments.map((segment, i) => 
          i === index ? { ...segment, speakerId: '' } : segment
        )
      };
      setEditingContent(newContent);
      return;
    }

    const newContent = {
      ...editingContent,
      segments: editingContent.segments.map((segment, i) => 
        (i === index || (modifyAll && segment.speakerId === originalSpeakerId))
          ? { ...segment, speakerId: newSpeakerId }
          : segment
      )
    };

    setEditingContent(newContent);
    onEdit(JSON.stringify(newContent));
    setEditingSpeakerId(null);
    setModifyAll(false);
  };

  const handleNewSpeaker = (index: number) => {
    if (!newSpeakerInput.trim()) return;

    const newContent = {
      ...editingContent,
      segments: editingContent.segments.map((segment, i) => 
        i === index ? { ...segment, speakerId: newSpeakerInput.trim() } : segment
      )
    };

    setEditingContent(newContent);
    onEdit(JSON.stringify(newContent));
    setEditingSpeakerId(null);
    setNewSpeakerInput('');
  };

  const renderContent = () => {
    return (
      <div className="viewer">
        {editingContent.segments.map((speakerSegment, index) => (
          <div key={`speaker-${index}`} className="speaker-section">
            {renderSpeakerLabel(
              speakerSegment.speakerId, 
              speakerSegment.startTime,
              index
            )}
            <div className="speaker-content">
              {speakerSegment.segments.map((segment, i) => 
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
      const formattedText = editingContent.segments
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