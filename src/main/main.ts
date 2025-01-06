// @ts-nocheck
const electron = require('electron');
const { app, BrowserWindow, ipcMain, Menu } = electron;
require('@electron/remote/main').initialize();
const path = require('path');
const isDev = require('electron-is-dev');
const { PythonShell } = require('python-shell');

function getPythonPath() {
  if (isDev) {
    return path.join(process.cwd(), 'venv/bin/python3');
  }
  return path.join(process.resourcesPath, 'venv/bin/python3');
}

function getCorePath() {
  if (isDev) {
    return path.join(__dirname, '../core');
  }
  return path.join(process.resourcesPath, 'core');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    }
  });

  require('@electron/remote/main').enable(win.webContents);

  if (isDev) {
    win.loadURL('http://localhost:3001');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  // 创建开发者菜单
  const template = [
    {
      label: '开发',
      submenu: [
        {
          label: '开发者工具',
          accelerator: process.platform === 'darwin' ? 'Command+Option+I' : 'Ctrl+Shift+I',
          click: () => {
            win.webContents.openDevTools();
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // 添加右键菜单
  win.webContents.on('context-menu', (_, props) => {
    const menu = Menu.buildFromTemplate([
      {
        label: '检查元素',
        click: () => {
          win.webContents.openDevTools();
        }
      }
    ]);
    menu.popup();
  });

  // 添加 IPC 调试日志
  ipcMain.on('electron-store-get', async (event, val) => {
    console.log('IPC 请求:', val);
  });

  // 修改通配符监听方式
  ipcMain.on('ipc-message', (event, ...args) => {
    console.log('收到 IPC 消息:', args);
  });

  // 或者使用 handle 方式
  ipcMain.handle('ipc-message', async (event, ...args) => {
    console.log('收到 IPC 消息:', args);
    return true;
  });
}

// 在 app.whenReady() 之前注册所有 IPC 处理程序
ipcMain.handle('transcribe-audio', async (event, filePath) => {
  console.log('收到转录请求:', filePath);
  try {
    // 检查文件路径
    if (!filePath) {
      throw new Error('未提供文件路径');
    }

    // 规范化路径并转换为绝对路径
    filePath = path.resolve(filePath);
    console.log('处理后的文件路径:', filePath);

    // 检查文件是否存在
    try {
      const stats = require('fs').statSync(filePath);
      if (!stats.isFile()) {
        throw new Error(`不是有效的文件: ${filePath}`);
      }
      console.log('文件信息:', {
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime
      });
    } catch (err) {
      throw new Error(`文件不存在或无法访问: ${filePath}`);
    }

    const pythonPath = isDev 
      ? path.join(process.cwd(), 'venv/bin/python3')
      : path.join(process.resourcesPath, 'venv/bin/python3');
    
    // 检查 Python 是否可用
    try {
      require('child_process').execSync(`${pythonPath} --version`);
      console.log('Python 可用');
    } catch (err) {
      console.error('Python 不可用:', err);
      throw new Error('Python 环境未正确配置');
    }
    
    const scriptPath = isDev 
      ? path.join(__dirname, '../src/core')
      : path.join(process.resourcesPath, 'app/core');
    
    // 检查所有必要的 Python 文件
    const requiredFiles = [
      'transcribe.py',
      'whisper_transcriber.py'
    ];
    
    for (const file of requiredFiles) {
      const fullPath = path.join(scriptPath, file);
      if (!require('fs').existsSync(fullPath)) {
        throw new Error(`缺少必要文件: ${file}`);
      }
      console.log(`找到文件: ${file}`);
    }

    const options: Options = {
      mode: 'text',
      pythonPath: pythonPath,
      pythonOptions: ['-u'],
      scriptPath: scriptPath,
      args: [filePath]
    };

    console.log('Python 配置:', JSON.stringify(options, null, 2));

    return new Promise((resolve, reject) => {
      let output = '';
      let errorOutput = '';
      
      console.log('启动 Python 进程...');
      const pyshell = new PythonShell('transcribe.py', options);

      pyshell.on('message', (message: string) => {
        console.log('Python 输出:', message);
        if (message.startsWith('PROGRESS:')) {
          const progress = parseInt(message.split(':')[1]);
          console.log('转录进度:', progress);
          event.sender.send('transcription-progress', progress);
        } else {
          output += message + '\n';
        }
      });

      pyshell.on('error', (err: Error) => {
        console.error('Python错误:', err);
        reject(err);
      });

      pyshell.on('close', (code: number) => {
        console.log(`Python进程退出，退出码: ${code}`);
      });

      pyshell.end((err: Error | null) => {
        if (err) {
          console.error('转录失败:', err);
          reject(err);
          return;
        }
        console.log('转录完成');
        resolve(output.trim());
      });
    });
  } catch (error) {
    console.error('转录错误:', error);
    throw error;
  }
});

// 添加文件处理函数
ipcMain.handle('save-temp-file', async (event, { buffer, filename }) => {
  try {
    const tempPath = path.join(app.getPath('temp'), filename);
    require('fs').writeFileSync(tempPath, Buffer.from(buffer));
    console.log('临时文件已保存:', tempPath);
    return tempPath;
  } catch (error) {
    console.error('保存临时文件失败:', error);
    throw error;
  }
});

ipcMain.handle('delete-temp-file', async (event, filepath) => {
  try {
    require('fs').unlinkSync(filepath);
    console.log('临时文件已删除:', filepath);
    return true;
  } catch (error) {
    console.error('删除临时文件失败:', error);
    return false;
  }
});

// 等待应用准备就绪后再创建窗口和注册其他处理程序
app.whenReady().then(() => {
  createWindow();

  // 注册其他 IPC 处理程序
  ipcMain.on('electron-store-get', async (event, val) => {
    console.log('IPC 请求:', val);
  });

  ipcMain.on('ipc-message', (event, ...args) => {
    console.log('收到 IPC 消息:', args);
  });

  ipcMain.handle('ipc-message', async (event, ...args) => {
    console.log('收到 IPC 消息:', args);
    return true;
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 导出路径获取函数供其他模块使用
module.exports = {
  getPythonPath,
  getCorePath
};