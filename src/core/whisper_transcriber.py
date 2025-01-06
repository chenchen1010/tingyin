import whisper
from pathlib import Path
import re
from pydub import AudioSegment

class WhisperTranscriber:
    def __init__(self):
        self.model = None
        print("初始化 WhisperTranscriber")
        
    def clean_text(self, text):
        """对文本进行清理和优化"""
        corrections = {
            '的的': '的',
            '了了': '了',
            '吗吗': '吗',
            '呢呢': '呢',
            '嘛嘛': '嘛',
            '啊啊': '啊',
            '哦哦': '哦',
            '额额': '额',
        }
        
        for wrong, right in corrections.items():
            text = text.replace(wrong, right)
        
        text = re.sub(r'([，。！？；：])\s*([，。！？；：])', r'\1', text)
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def prepare_audio(self, audio_path):
        """准备音频文件"""
        try:
            audio = AudioSegment.from_file(audio_path)
            if Path(audio_path).suffix.lower() != '.mp3':
                temp_path = f"temp_{Path(audio_path).stem}.mp3"
                audio.export(temp_path, format="mp3")
                return temp_path
            return audio_path
        except Exception as e:
            print(f"处理音频时发生错误: {str(e)}")
            return audio_path
    
    def transcribe(self, audio_path, model_size="small"):
        """转录音频为文本"""
        print("正在处理音频...")
        try:
            audio_file = self.prepare_audio(audio_path)
            print(f"音频文件准备完成: {audio_file}")
            
            print(f"正在加载模型 {model_size}...")
            self.model = whisper.load_model(model_size)
            
            print(f"正在转录文件: {audio_path}")
            result = self.model.transcribe(
                audio_file,
                language="zh",
                task="transcribe",
                fp16=False,
                verbose=True,
                beam_size=5,
                best_of=5,
                temperature=0.0,
                condition_on_previous_text=True,
                initial_prompt="这是一段多人对话的中文音频。"
            )
            
            # 清理临时文件
            if audio_file.startswith("temp_"):
                Path(audio_file).unlink(missing_ok=True)
            
            return result["segments"]
        except Exception as e:
            print(f"转录音频时发生错误: {str(e)}")
            return []