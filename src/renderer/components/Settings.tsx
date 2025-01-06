import React from 'react';

export const Settings: React.FC = () => {
  return (
    <div className="settings">
      <h2>设置</h2>
      <div className="setting-item">
        <label>存储路径：</label>
        <input type="text" placeholder="选择存储路径..." />
      </div>
    </div>
  );
}; 