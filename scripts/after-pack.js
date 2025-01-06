const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

exports.default = async function(context) {
  const { appOutDir, packager, electronPlatformName } = context;
  
  if (electronPlatformName === 'darwin') {
    console.log('Setting up Python environment...');
    
    const appResourcesPath = path.join(appOutDir, 'Contents/Resources');
    const venvPath = path.join(appResourcesPath, 'venv');
    
    try {
      // 创建新的虚拟环境
      execSync(`python3 -m venv "${venvPath}"`);
      
      // 激活虚拟环境并安装依赖
      const pipPath = path.join(venvPath, 'bin/pip');
      execSync(`"${pipPath}" install -r requirements.txt`);
      
      console.log('Python environment setup completed');
    } catch (error) {
      console.error('Error setting up Python environment:', error);
      throw error;
    }
  }
}; 