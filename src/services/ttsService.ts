import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene } from '../types/screenplay';
import { decodeAudioBase64, stitchAudioBuffers, audioBufferToWavBlob, blobToBase64 } from '../utils/audioUtils';

export interface TTSApiResponse {
  audioBase64: string;
  mimeType: string;
  speakers?: string[];
  turnIds?: string[];
  modelUsed?: string;
}

// Synthesize turns via the backend proxy
export async function callBackendSynthesize(
  turns: Array<{ id: string; speaker: string; text: string; emotion?: string; vocalizeSpeakerName?: boolean }>,
  voiceAssignments: Record<string, { voiceName: GeminiPrebuiltVoice; basePersonality?: string }>
): Promise<TTSApiResponse> {
  const response = await fetch('/api/tts/synthesize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      turns,
      voiceAssignments,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Synthesis failed with status ${response.status}`);
  }

  return data;
}

// Audition a voice with custom delivery style
export async function auditionVoicePersona(
  voiceName: GeminiPrebuiltVoice,
  personality: string,
  previewText?: string
): Promise<string> {
  const response = await fetch('/api/tts/audition', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voiceName,
      personality,
      previewText,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Audition failed with status ${response.status}`);
  }

  return data.audioBase64;
}

/**
 * Synthesizes an individual dialogue turn.
 * Provides a dedicated audio take for this turn so the user can play or download it individually.
 */
export async function synthesizeSingleTurn(
  turn: DialogueTurn,
  characterVoices: CharacterVoice[]
): Promise<{ audioBase64: string; duration: number }> {
  const speaker = turn.speaker.trim();
  const cv = characterVoices.find((c) => c.name.trim().toLowerCase() === speaker.toLowerCase());
  const voiceName = cv ? cv.voiceName : 'Fenrir';
  const basePersonality = cv ? cv.basePersonality : 'Historical dramatic performance';

  const voiceMap = {
    [speaker]: {
      voiceName,
      basePersonality,
    },
  };

  const payload = [
    {
      id: turn.id,
      speaker,
      text: turn.text.trim(),
      emotion: turn.emotion.trim(),
      vocalizeSpeakerName: turn.vocalizeSpeakerName ?? false,
    },
  ];

  const result = await callBackendSynthesize(payload, voiceMap);
  const buffer = await decodeAudioBase64(result.audioBase64);

  return {
    audioBase64: result.audioBase64,
    duration: buffer.duration,
  };
}

/**
 * Synthesize an entire scene turn-by-turn and stitch:
 * Guarantees every turn gets its own individual audio take (with individual play/download buttons)
 * and then stitches the entire sequence into the unified scene master take.
 */
export async function synthesizeFullScene(
  scene: Scene,
  characterVoices: CharacterVoice[],
  onProgress?: (progressText: string, current: number, total: number) => void
): Promise<{
  sceneAudioBase64: string;
  sceneDuration: number;
  turnAudios: Record<string, { audioBase64: string; duration: number }>;
}> {
  if (scene.dialogueTurns.length === 0) {
    throw new Error(`Scene ${scene.sceneNumber} contains no spoken dialogue turns.`);
  }

  const turnBuffers: AudioBuffer[] = [];
  const turnAudios: Record<string, { audioBase64: string; duration: number }> = {};
  const totalTurns = scene.dialogueTurns.length;

  for (let i = 0; i < totalTurns; i++) {
    const turn = scene.dialogueTurns[i];
    onProgress?.(
      `Voicing Turn ${i + 1}/${totalTurns} (${turn.speaker})...`,
      i,
      totalTurns
    );

    const turnResult = await synthesizeSingleTurn(turn, characterVoices);
    const audioBuffer = await decodeAudioBase64(turnResult.audioBase64);
    turnBuffers.push(audioBuffer);

    turnAudios[turn.id] = {
      audioBase64: turnResult.audioBase64,
      duration: audioBuffer.duration,
    };
  }

  onProgress?.(`Stitching Scene ${scene.sceneNumber} Master Take...`, totalTurns, totalTurns);

  // Stitch all turn buffers with 250ms room silence pause
  const stitchedBuffer = stitchAudioBuffers(turnBuffers, 0.25);
  const wavBlob = audioBufferToWavBlob(stitchedBuffer);
  const sceneAudioBase64 = await blobToBase64(wavBlob);

  return {
    sceneAudioBase64,
    sceneDuration: stitchedBuffer.duration,
    turnAudios,
  };
}
