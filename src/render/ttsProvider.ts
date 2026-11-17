import { estimateNarrationDurationSec } from '../engine/autoEpisode';
import type {
  TtsProvider,
  TtsSynthesisResult,
  TtsVoiceSettings,
} from './rendererTypes';

export class ManualAudioProvider implements TtsProvider {
  id = 'manual';
  name = 'Manual Narration / Uploaded Audio';
  requiresCredentials = false;

  async generateSpeech(
    text: string,
    _voice: string,
    _settings: TtsVoiceSettings
  ): Promise<TtsSynthesisResult> {
    return {
      supported: true,
      providerId: this.id,
      estimatedDurationSec: estimateNarrationDurationSec(text),
      note: 'Manual recording or uploaded MP3/WAV asset used on Voiceover track.',
    };
  }
}

export class BrowserSpeechPreviewProvider implements TtsProvider {
  id = 'browser-speech-preview';
  name = 'Browser SpeechSynthesis (Preview Only)';
  requiresCredentials = false;

  async generateSpeech(
    text: string,
    voice: string,
    settings: TtsVoiceSettings
  ): Promise<TtsSynthesisResult> {
    const est = estimateNarrationDurationSec(text);
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return {
        supported: false,
        providerId: this.id,
        estimatedDurationSec: est,
        note: 'Web SpeechSynthesis API is unavailable in this browser.',
      };
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.5, Math.min(2, settings.rate || 1));
      utterance.pitch = Math.max(0.5, Math.min(2, settings.pitch || 1));
      utterance.lang = settings.lang || 'en-US';
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find(
        (v) => v.name === voice || v.name === settings.voiceName
      );
      if (match) utterance.voice = match;
      window.speechSynthesis.speak(utterance);
      return {
        supported: true,
        providerId: this.id,
        estimatedDurationSec: est,
        note: 'Triggered live browser SpeechSynthesis preview (not captured to MP4).',
      };
    } catch {
      return {
        supported: false,
        providerId: this.id,
        estimatedDurationSec: est,
        note: 'SpeechSynthesis preview failed; upload audio for MP4 export.',
      };
    }
  }
}

function createFutureCloudStub(id: string, name: string): TtsProvider {
  return {
    id,
    name,
    requiresCredentials: true,
    async generateSpeech(text: string): Promise<TtsSynthesisResult> {
      return {
        supported: false,
        providerId: id,
        estimatedDurationSec: estimateNarrationDurationSec(text),
        note: `${name} adapter ready for future API integration (no credentials configured).`,
      };
    },
  };
}

export const TTS_PROVIDERS: TtsProvider[] = [
  new ManualAudioProvider(),
  new BrowserSpeechPreviewProvider(),
  createFutureCloudStub('elevenlabs', 'ElevenLabs TTS (Adapter)'),
  createFutureCloudStub('openai-tts', 'OpenAI TTS (Adapter)'),
  createFutureCloudStub('google-tts', 'Google Cloud TTS (Adapter)'),
  createFutureCloudStub('azure-tts', 'Azure Speech TTS (Adapter)'),
];
