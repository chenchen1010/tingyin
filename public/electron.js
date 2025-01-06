const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const { PythonShell } = require('python-shell');
const fs = require('fs');

// 将 pythonPath 的声明移到全局作用域
const pythonPath = isDev 
  ? path.join(process.cwd(), 'venv/bin/python3')
  : path.join(process.resourcesPath, 'venv/bin/python3');

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

  if (isDev) {
    win.loadURL('http://localhost:3001');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../build/index.html'));
  }

  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
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

// 处理音频转录
ipcMain.handle('transcribe-audio', async (event, filePath, numSpeakers, modelSize) => {
  try {
    console.log('收到转录请求:', filePath);
    console.log('说话人数量:', numSpeakers);  // 添加日志
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    // 设置 Python 选项
    let options = {
      mode: 'text',
      pythonPath: pythonPath,
      pythonOptions: ['-u'],
      scriptPath: path.join(__dirname, '../src/core'),
      args: [filePath, numSpeakers.toString(), modelSize]
    };

    // 如果指定了说话人数量，添加到参数中
    if (numSpeakers) {
      options.args.push(numSpeakers.toString());
    }

    const sendLog = (message) => {
      event.sender.send('transcription-log', message);
      console.log('日志:', message);
    };

    sendLog('开始处理音频文件...');
    
    // 检查 Python 是否可用
    try {
      const pythonVersion = require('child_process').execSync(`${pythonPath} --version`, { encoding: 'utf8' });
      console.log('Python 版本:', pythonVersion);
      
      // 检查 whisper 是否已安装
      const pipList = require('child_process').execSync(`${pythonPath} -m pip list`, { encoding: 'utf8' });
      console.log('已安装的包:', pipList);
      
      if (!pipList.includes('openai-whisper')) {
        throw new Error('Whisper 包未安装');
      }
      
      console.log('Python 环境检查通过');
    } catch (err) {
      console.error('Python 环境检查失败:', err);
      throw new Error(`Python 环境未正确配置: ${err.message}`);
    }

    // 检查文件是否存在
    if (!require('fs').existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
    console.log('文件存在，大小:', require('fs').statSync(filePath).size);

    // 打印当前工作目录
    console.log('当前工作目录:', process.cwd());
    
    const scriptPath = isDev 
      ? path.join(process.cwd(), 'src/core')
      : path.join(process.resourcesPath, 'app/core');
    
    console.log('脚本路径:', {
      scriptPath,
      transcribePy: path.join(scriptPath, 'transcribe.py'),
      whisperPy: path.join(scriptPath, 'whisper_transcriber.py')
    });
    
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

    console.log('Python 配置:', JSON.stringify(options, null, 2));

    return new Promise((resolve, reject) => {
      let output = '';
      let hasResult = false;
      
      console.log('启动 Python 进程...');
      const pyshell = new PythonShell('transcribe.py', options);

      pyshell.on('message', (message) => {
        console.log('Python 输出:', message);
        sendLog(message);
      });

      pyshell.on('error', (err) => {
        console.error('Python错误:', err);
        sendLog(`转录错误: ${err.message}`);
        reject(err);
      });

      pyshell.on('close', async (code) => {
        console.log(`Python进程退出，退出码: ${code}`);
        
        // 检查结果文件
        const speakerResultPath = filePath.replace(/\.[^/.]+$/, '_说话人识别结果.json');
        console.log('结果文件路径:', speakerResultPath);
        
        // 检查文件是否存在
        const fileExists = require('fs').existsSync(speakerResultPath);
        console.log('结果文件是否存在:', fileExists);
        
        if (fileExists) {
            try {
                // 读取文件并移除可能的 BOM
                let speakerResult = fs.readFileSync(speakerResultPath);
                // 检查并移除 BOM
                if (speakerResult[0] === 0xEF && speakerResult[1] === 0xBB && speakerResult[2] === 0xBF) {
                    speakerResult = speakerResult.slice(3);
                }
                const resultText = speakerResult.toString('utf8');
                
                try {
                    const result = JSON.parse(resultText);
                    if (result && result.segments) {
                        output = result;
                        hasResult = true;
                        sendLog('转录和说话人识别完成');
                        resolve(output);
                        return;
                    }
                } catch (parseError) {
                    console.error('JSON 解析错误:', parseError);
                    console.log('原始文件内容:', resultText);
                    sendLog(`JSON 解析错误: ${parseError.message}`);
                    reject(parseError);
                    return;
                }
            } catch (readError) {
                console.error('读取文件错误:', readError);
                sendLog(`读取文件错误: ${readError.message}`);
                reject(readError);
                return;
            }
        }

        // 如果没有找到结果，等待一段时间后重试
        setTimeout(async () => {
          try {
            if (require('fs').existsSync(speakerResultPath)) {
              const speakerResult = require('fs').readFileSync(speakerResultPath, 'utf8');
              if (speakerResult.trim()) {
                output = speakerResult;
                hasResult = true;
                sendLog('转录和说话人识别完成');
                resolve(output.trim());
                return;
              }
            }
            sendLog('未能获取转录结果');
            reject(new Error('未能获取转录结果'));
          } catch (err) {
            console.error('重试读取结果失败:', err);
            reject(err);
          }
        }, 3000); // 等待 3 秒
      });

      pyshell.end((err) => {
        if (err) {
          console.error('转录失败:', err);
          reject(err);
          return;
        }
        
        // 只在没有其他结果时处理
        if (!hasResult) {
          console.log('pyshell.end - hasResult:', hasResult);
          console.log('pyshell.end - output:', output);
          
          if (!output.trim()) {
            sendLog('警告：未获取到转录结果');
            reject(new Error('转录结果为空'));
            return;
          }
        }
      });
    });
  } catch (error) {
    console.error('转录失败:', error);
    throw error;
  }
});

// 添加导出文件处理函数
ipcMain.handle('export-result', async (event, content) => {
  try {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出转录结果',
      defaultPath: '转录结果.txt',
      filters: [
        { name: '文本文件', extensions: ['txt'] }
      ]
    });

    if (filePath) {
      // 直接写入格式化后的文本内容
      await require('fs').promises.writeFile(filePath, content, 'utf8');
      return true;
    }
    return false;
  } catch (error) {
    console.error('导出文件失败:', error);
    throw error;
  }
});

// 辅助函数：格式化时间
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
} 