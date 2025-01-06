import React, { useEffect, useRef } from 'react';

interface Props {
  logs: string[];
}

export const LogViewer: React.FC<Props> = ({ logs }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 当日志更新时，自动滚动到底部
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="log-viewer">
      <h3>处理日志</h3>
      <div 
        ref={containerRef} 
        className="log-container"
      >
        {logs.map((log, index) => (
          <div key={index} className="log-item">
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}; 