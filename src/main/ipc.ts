import { ipcMain } from 'electron';
import { PythonService } from './pythonService';
import { Settings } from './settings';

export function setupIPC() {
  const pythonService = new PythonService();
  const settings = new Settings();

  ipcMain.handle('transcribe-audio', async (event, filePath) => {
    try {
      const result = await pythonService.transcribeAudio(filePath);
      return result;
    } catch (error) {
      console.error('转录错误:', error);
      throw error;
    }
  });

  ipcMain.handle('recognize-speakers', async (event, filePath) => {
    try {
      const result = await pythonService.recognizeSpeakers(filePath);
      return result;
    } catch (error) {
      console.error('说话人识别错误:', error);
      throw error;
    }
  });

  ipcMain.handle('save-settings', async (event, newSettings) => {
    settings.save(newSettings);
  });
} 