export interface Segment {
  text: string;
  start: number;
  end: number;
}

export interface SpeakerSegment {
  speakerId: string;
  startTime: number;
  segments: Segment[];
}

export interface TranscriptionData {
  segments: SpeakerSegment[];
} 