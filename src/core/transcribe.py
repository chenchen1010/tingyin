import sys
import os
from whisper_transcriber import WhisperTranscriber
from speaker_recognizer import SpeakerRecognizer

def main():
    if len(sys.argv) < 2:
        print("请提供音频文件路径")
        return

    audio_path = sys.argv[1]
    num_speakers = int(sys.argv[2]) if len(sys.argv) > 2 else 2
    model_size = sys.argv[3] if len(sys.argv) > 3 else "small"

    print(f"处理文件: {audio_path}")
    print(f"说话人数量: {num_speakers}")
    print(f"使用模型: {model_size}")

    transcriber = WhisperTranscriber()
    segments = transcriber.transcribe(audio_path, model_size)

    # 处理结果
    print("PROGRESS:50")
    result = []
    for segment in segments:
        result.append({
            'text': segment['text'],
            'start': segment['start'],
            'end': segment['end']
        })
        
    # 调用说话人识别
    print("开始说话人识别...")
    recognizer = SpeakerRecognizer()
    formatted_text = recognizer.recognize_speakers(audio_path, result, num_speakers)
    
    # 确认结果文件已生成
    result_path = audio_path.replace('.mp3', '_说话人识别结果.txt')
    if os.path.exists(result_path):
        with open(result_path, 'r', encoding='utf-8') as f:
            content = f.read()
            print(f"结果文件内容长度: {len(content)}")
            if content.strip():
                print("结果文件生成成功")
            else:
                print("警告: 结果文件为空")
    else:
        print(f"警告: 结果文件未生成: {result_path}")
        
    print("PROGRESS:100")
    print("转录完成")

if __name__ == "__main__":
    main()