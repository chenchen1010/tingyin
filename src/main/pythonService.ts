import { PythonShell, Options } from 'python-shell';
import * as path from 'path';
import * as isDev from 'electron-is-dev';

export class PythonService {
  private whisperPath: string;
  private speakerPath: string;
  private pythonPath: string;
  private corePath: string;

  constructor() {
    this.whisperPath = path.join(__dirname, '../core/whisper_transcriber.py');
    this.speakerPath = path.join(__dirname, '../core/speaker_recognizer.py');
    this.pythonPath = isDev 
      ? path.join(process.cwd(), 'venv/bin/python3')
      : path.join(process.resourcesPath, 'venv/bin/python3');
    this.corePath = isDev
      ? path.join(__dirname, '../core')
      : path.join(process.resourcesPath, 'core');
  }

  async transcribeAudio(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: Options = {
        mode: 'text' as const,
        pythonPath: this.pythonPath,
        pythonOptions: ['-u'],
        scriptPath: path.dirname(this.whisperPath),
        args: [audioPath]
      };

      PythonShell.run(path.basename(this.whisperPath), options).then(messages => {
        resolve(messages.join('\n'));
      }).catch(reject);
    });
  }

  async recognizeSpeakers(audioPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const options: Options = {
        mode: 'text' as const,
        pythonPath: this.pythonPath,
        pythonOptions: ['-u'],
        scriptPath: path.dirname(this.speakerPath),
        args: [audioPath]
      };

      PythonShell.run(path.basename(this.speakerPath), options).then(messages => {
        resolve(messages.join('\n'));
      }).catch(reject);
    });
  }
} 