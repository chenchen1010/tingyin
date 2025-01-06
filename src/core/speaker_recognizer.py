import librosa
import numpy as np
from sklearn.cluster import AgglomerativeClustering
from tqdm import tqdm
import time
import os
import re
import json

class SpeakerRecognizer:
    def __init__(self):
        self.weights = {
            'pitch': 0.2,
            'spectral_centroid': 0.15,
            'rms_energy': 0.05,
            'zero_crossing_rate': 0.05,
            'mfccs': 0.55
        }
    
    def extract_features(self, audio_path, start_time, end_time, sr=16000):
        """提取音频特征"""
        y, sr = librosa.load(audio_path, sr=sr, offset=start_time, duration=end_time-start_time)
        
        features = {}
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        features['pitch'] = float(np.mean(pitches[magnitudes > np.median(magnitudes)]))
        features['spectral_centroid'] = float(np.mean(librosa.feature.spectral_centroid(y=y, sr=sr)))
        features['rms_energy'] = float(np.mean(librosa.feature.rms(y=y)))
        features['zero_crossing_rate'] = float(np.mean(librosa.feature.zero_crossing_rate(y)))
        features['mfccs'] = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13).mean(axis=1).tolist()
        
        return features
    
    def calculate_similarity(self, features1, features2):
        """计算特征相似度"""
        similarity = 0
        for key, weight in self.weights.items():
            if key == 'mfccs':
                similarity += weight * np.dot(features1[key], features2[key]) / (
                    np.linalg.norm(features1[key]) * np.linalg.norm(features2[key]))
            else:
                similarity -= weight * abs(features1[key] - features2[key])
        return similarity
    
    def recognize_speakers(self, audio_path, segments, num_speakers=None):
        """识别说话人"""
        try:
            print("\n正在分析说话人特征...")
            all_segments_features = []
            
            # 提取特征
            with tqdm(total=len(segments), desc="处理进度") as pbar:
                for segment in segments:
                    start_time = segment.get("start", 0)
                    end_time = segment.get("end", 0)
                    features = self.extract_features(audio_path, start_time, end_time)
                    
                    all_segments_features.append({
                        'features': features,
                        'start': start_time,
                        'end': end_time,
                        'text': segment["text"]
                    })
                    pbar.update(1)
            
            # 准备特征矩阵
            feature_matrix = []
            for segment in all_segments_features:
                features = []
                features.extend(segment['features']['mfccs'])
                features.append(segment['features']['pitch'])
                features.append(segment['features']['spectral_centroid'])
                feature_matrix.append(features)
            
            # 如果未指定说话人数量，使用默认值2
            if num_speakers is None:
                num_speakers = 2
                print(f"未指定说话人数量，使用默认值: {num_speakers}")
            else:
                print(f"使用指定的说话人数量: {num_speakers}")
            
            # 聚类分析
            clustering = AgglomerativeClustering(
                n_clusters=num_speakers,
                linkage='average'
            )
            labels = clustering.fit_predict(feature_matrix)
            
            # 修改结果格式
            formatted_segments = []
            current_speaker = None
            current_segments = []
            current_start_time = None
            
            for i, segment in enumerate(all_segments_features):
                speaker_id = f"说话人{labels[i] + 1}"
                
                # 说话人改变时添加到结果中
                if speaker_id != current_speaker:
                    if current_segments:
                        formatted_segments.append({
                            "speakerId": current_speaker,
                            "startTime": current_start_time,
                            "segments": current_segments
                        })
                    current_speaker = speaker_id
                    current_segments = []
                    current_start_time = float(segment['start'])
                
                # 添加当前片段
                current_segments.append({
                    "text": str(segment['text']).strip(),
                    "start": float(segment['start']),
                    "end": float(segment['end'])
                })
            
            # 添加最后一个说话人的片段
            if current_segments:
                formatted_segments.append({
                    "speakerId": current_speaker,
                    "startTime": current_start_time,
                    "segments": current_segments
                })

            # 转换为 JSON 格式
            result = {
                "segments": formatted_segments
            }
            
            # 保存结果到文件
            base_name = os.path.splitext(audio_path)[0]
            result_path = f"{base_name}_说话人识别结果.json"

            try:
                # 确保 JSON 格式正确
                json_str = json.dumps(result, ensure_ascii=False, indent=2)
                # 使用二进制模式写入，避免编码问题
                with open(result_path, 'w', encoding='utf-8') as f:
                    # 确保写入前没有 BOM
                    if not f.tell():  # 如果在文件开始
                        f.write(json_str)
                    else:
                        f.seek(0)
                        f.write(json_str)
                        f.truncate()
                print(f"结果已保存到: {result_path}")
            except Exception as e:
                print(f"保存结果文件时出错: {str(e)}")
            
            return result

        except Exception as e:
            print(f"说话人识别失败: {str(e)}")
            raise

def recognize_speakers(audio_path, segments, num_speakers=None):
    """便捷函数用于直接调用说话人识别"""
    recognizer = SpeakerRecognizer()
    return recognizer.recognize_speakers(audio_path, segments, num_speakers) 