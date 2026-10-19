import { CharacterVoice, DialogueTurn, GeminiPrebuiltVoice, Scene, Screenplay } from '../types/screenplay';

const PREBUILT_VOICE_ROTATION: GeminiPrebuiltVoice[] = ['Fenrir', 'Kore', 'Puck', 'Charon', 'Zephyr'];
const CHARACTER_COLOR_PALETTE = [
  '#f59e0b', // amber
  '#38bdf8', // sky
  '#ec4899', // pink
  '#10b981', // emerald
  '#a855f7', // purple
  '#f97316', // orange
  '#06b6d4', // cyan
];

// Helper to resolve voice name from user text (supports prebuilt voice names and natural gender/timbre descriptions)
export function parseVoiceDescriptor(descriptor: string): GeminiPrebuiltVoice {
  const s = descriptor.toLowerCase().trim();
  if (s.includes('kore') || s.includes('female') || s.includes('woman') || s.includes('queen') || s.includes('soprano') || s.includes('lady')) {
    return 'Kore';
  }
  if (s.includes('charon') || s.includes('bass') || s.includes('dark') || s.includes('grave') || s.includes('priest') || s.includes('ancient')) {
    return 'Charon';
  }
  if (s.includes('puck') || s.includes('tenor') || s.includes('youth') || s.includes('agile') || s.includes('young') || s.includes('boy')) {
    return 'Puck';
  }
  if (s.includes('zephyr') || s.includes('neutral') || s.includes('smooth') || s.includes('philosopher')) {
    return 'Zephyr';
  }
  if (s.includes('fenrir') || s.includes('baritone') || s.includes('deep') || s.includes('male') || s.includes('emperor') || s.includes('general')) {
    return 'Fenrir';
  }
  return 'Fenrir';
}

export const HISTORICAL_TEMPLATES: Array<{
  id: string;
  name: string;
  period: string;
  description: string;
  screenplayText: string;
}> = [
  {
    id: 'kalyana-court',
    name: 'The Royal Court at Kalyana (1117 CE)',
    period: 'Medieval India - Western Chalukya Empire',
    description: 'Imperial court drama with Emperor Vikramaditya VI and Narrator, showing in-script Voice and Style directions.',
    screenplayText: `TITLE: The Royal Court at Kalyana
ERA: 1117 CE, Western Chalukya Empire

SCENE 04 — THE ROYAL COURT

CONTEXT:
Kalyana, circa 1117 CE. The emperor has received reports of Hoysala expansion. The atmosphere is tense.

VOICE 1 — NARRATOR:
Voice: Fenrir
Style: Deep, measured, ominous.
"The news from the southern territories had reached the imperial court."

VOICE 2 — VIKRAMADITYA(IA):
Voice: Charon
Style: Controlled anger. Commanding, deliberate delivery.
"How long shall we permit this challenge to our authority?"

VOICE 1 — NARRATOR:
Voice: Fenrir
Style: Quiet suspense, building tension.
"No one in the hall dared to answer immediately."

VOICE 2 — VIKRAMADITYA(IA):
Voice: Charon
Style: Regal authority and resolute command.
"Summon the feudatories of Banavasi. Before the monsoon breaks, our banners shall fly over the Kaveri."
`,
  },
  {
    id: 'ides-of-march',
    name: 'The Ides of March (44 BC)',
    period: 'Ancient Rome - Roman Republic',
    description: '3-Speaker political tension in the Curia of Pompey between Caesar, Brutus, and Cassius.',
    screenplayText: `TITLE: The Ides of March
ERA: 44 BC, Ancient Rome

SCENE 1: INT. CURIA OF POMPEY - DUSK
The senate hall stands chilled in shadow. Conspirators circle the golden dais.

VOICE 1 — CAESAR(IA):
Voice: Fenrir
Style: Calm authority, sovereign dignity.
"Are we all ready? What is now amiss, that Caesar and his senate must redress?"

VOICE 2 — BRUTUS(IA):
Voice: Puck
Style: Restrained anxiety, intellectual contemplation.
"Most high, most mighty, and most puissant Caesar, Metellus Cimber throws before thy seat an humble heart."

VOICE 1 — CAESAR(IA):
Voice: Fenrir
Style: Cold, unyielding command.
"I must prevent thee, Cimber. Caesar does not turn for lowly flatteries."

VOICE 3 — CASSIUS(IA):
Voice: Charon
Style: Whispering with suppressed fury.
"Pardon, Caesar! Caesar, pardon! As low as to thy foot doth Cassius fall!"
`,
  },
  {
    id: 'tudor-council',
    name: 'The Tudor Council at Greenwich (1588)',
    period: 'Renaissance England - Elizabethan Era',
    description: '3-Speaker diplomatic standoff between Queen Elizabeth I (Female/Kore), Cecil, and Ambassador Mendoza.',
    screenplayText: `TITLE: The Tudor Council at Greenwich
ERA: 1588, Elizabethan England

SCENE 1: INT. COUNCIL CHAMBER, GREENWICH PALACE - CANDLELIGHT
Tapestries of heraldic beasts drape the oak-paneled chamber.

VOICE 1 — QUEEN ELIZABETH(IA):
Voice: Kore
Style: Regal, commanding defiance.
"Speak plainly, Cecil. Does King Philip believe his Armada shall cow the crown of England while my sailors yet draw breath?"

VOICE 2 — LORD CECIL(IA):
Voice: Fenrir
Style: Grave, calculated caution.
"Your Grace, their galleons have entered the narrow seas. One hundred and thirty warships, bristling with cast iron."

VOICE 3 — AMBASSADOR MENDOZA(IA):
Voice: Charon
Style: Haughty, veiled menace.
"Her Majesty would be wise to heed the terms. Spain seeks only the restoration of the true faith."
`,
  },
];

// Parser function supporting Voice/Gender, Style, (IA) flags, and quoted dialogue
export function parseScreenplayText(text: string): {
  screenplay: Screenplay;
  detectedCharacters: CharacterVoice[];
} {
  const cleanInput = text.replace(/\r\n/g, '\n').trim();
  if (!cleanInput) {
    return {
      screenplay: {
        id: `script-${Date.now()}`,
        title: 'Untitled Historical Screenplay',
        periodOrEra: 'Historical Era',
        scenes: [],
      },
      detectedCharacters: [],
    };
  }

  const lines = cleanInput.split('\n');
  let title = 'Historical Film Production';
  let era = 'Historical Era';
  const scenes: Scene[] = [];
  const characterNamesSet = new Set<string>();
  const characterExplicitVoices: Record<string, GeminiPrebuiltVoice> = {};
  const characterVoiceSources: Record<string, string> = {};

  let currentScene: Scene | null = null;
  let sceneCounter = 0;
  let turnCounter = 0;

  let inContextBlock = false;
  let currentContextLines: string[] = [];

  let currentSpeaker: string | null = null;
  let currentStyle: string = '';
  let currentVocalizeName: boolean = false;
  let currentDialogueLines: string[] = [];

  // Helper to commit a pending dialogue turn
  const commitTurn = () => {
    if (currentSpeaker && currentDialogueLines.length > 0) {
      let spokenText = currentDialogueLines.join(' ').trim();
      // Strip surrounding quotes: "The news..." -> The news...
      spokenText = spokenText.replace(/^["“](.*)["”]$/, '$1').trim();
      spokenText = spokenText.replace(/^"|"$/g, '').trim();

      if (spokenText) {
        if (!currentScene) {
          sceneCounter++;
          currentScene = {
            id: `scene-${sceneCounter}-${Date.now()}`,
            sceneNumber: sceneCounter,
            slug: `SCENE ${sceneCounter} — HISTORICAL SOUNDSTAGE`,
            context: '',
            dialogueTurns: [],
            status: 'idle',
          };
          scenes.push(currentScene);
        }

        turnCounter++;
        characterNamesSet.add(currentSpeaker);

        currentScene.dialogueTurns.push({
          id: `turn-${turnCounter}-${Date.now()}`,
          speaker: currentSpeaker,
          text: spokenText,
          emotion: currentStyle.trim() || 'Measured historical delivery',
          vocalizeSpeakerName: currentVocalizeName,
          status: 'idle',
        });
      }

      currentDialogueLines = [];
      currentStyle = '';
      currentSpeaker = null;
      currentVocalizeName = false;
    }
  };

  // Helper to commit context lines to current scene
  const commitContext = () => {
    if (currentScene && currentContextLines.length > 0) {
      const merged = currentContextLines.join(' ').trim();
      if (merged) {
        currentScene.context = currentScene.context
          ? `${currentScene.context}\n\n${merged}`
          : merged;
      }
      currentContextLines = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    if (!line) {
      if (inContextBlock) {
        commitContext();
        inContextBlock = false;
      }
      continue;
    }

    // 1. Detect Metadata: TITLE: or ERA:
    if (/^TITLE\s*[:=]/i.test(line)) {
      title = line.replace(/^TITLE\s*[:=]\s*/i, '').trim();
      continue;
    }
    if (/^(ERA|PERIOD|SETTING)\s*[:=]/i.test(line)) {
      era = line.replace(/^(ERA|PERIOD|SETTING)\s*[:=]\s*/i, '').trim();
      continue;
    }

    // 2. Detect Scene Heading: e.g. "SCENE 04 — THE ROYAL COURT", "SCENE 1: ...", "INT. ..."
    const isSceneHeader =
      /^(SCENE\s+\d+|ACT\s+\d+|INT\.|EXT\.|INT\/EXT\.|###?\s+SCENE|#\s+SCENE|#\s+INT|#\s+EXT)/i.test(line);

    if (isSceneHeader) {
      commitTurn();
      commitContext();
      inContextBlock = false;
      sceneCounter++;
      let slug = line.replace(/^#+\s*/, '').trim();
      currentScene = {
        id: `scene-${sceneCounter}-${Date.now()}`,
        sceneNumber: sceneCounter,
        slug,
        context: '',
        dialogueTurns: [],
        status: 'idle',
      };
      scenes.push(currentScene);
      continue;
    }

    // 3. Detect Context Block: e.g. "CONTEXT:" or "SETTING:"
    const contextHeaderMatch = line.match(/^(?:CONTEXT|STAGE DIRECTIONS?|ATMOSPHERE)\s*[:=]?\s*(.*)$/i);
    if (contextHeaderMatch) {
      commitTurn();
      commitContext();
      inContextBlock = true;
      const inlineRemainder = contextHeaderMatch[1].trim();
      if (inlineRemainder) {
        currentContextLines.push(inlineRemainder);
      }
      continue;
    }

    // 4. In-Script Voice or Gender Selection on separate line:
    // e.g. "Voice: Fenrir", "Voice: Kore", "Voice: Female", "Gender: Female", "Voice: Charon"
    const voiceMatch = line.match(/^(?:Voice|Gender|Actor|Timbre)\s*[:=]\s*(.+)$/i);
    if (voiceMatch) {
      inContextBlock = false;
      const rawDescriptor = voiceMatch[1].trim();
      const resolvedVoice = parseVoiceDescriptor(rawDescriptor);
      if (currentSpeaker) {
        characterExplicitVoices[currentSpeaker] = resolvedVoice;
        characterVoiceSources[currentSpeaker] = `In-Script (Voice: ${rawDescriptor})`;
      }
      continue;
    }

    // 5. In-Script Style / Tone lines:
    // e.g. "Style: Deep, measured, ominous." or "Style: Female voice (Kore), regal defiance"
    const styleMatch = line.match(/^(?:Style|Tone|Delivery|Mood|Direction|Emotion|Pacing)\s*[:=]\s*(.+)$/i);
    if (styleMatch) {
      inContextBlock = false;
      const rawStyle = styleMatch[1].trim();

      // Check if the user embedded voice or gender inside the Style line!
      const hasVoiceInStyle = /(?:female|woman|queen|soprano|kore|male|baritone|bass|grave|tenor|youth|puck|charon|fenrir|zephyr)/i.test(rawStyle);
      if (hasVoiceInStyle && currentSpeaker && !characterExplicitVoices[currentSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(rawStyle);
        characterExplicitVoices[currentSpeaker] = detectedVoice;
        characterVoiceSources[currentSpeaker] = `From Style (${detectedVoice})`;

        // Clean out the voice/gender keyword from the emotional delivery instruction sent to Gemini TTS
        currentStyle = rawStyle
          .replace(/\b(?:voice|gender|actor)\s*[:=]?\s*(?:fenrir|charon|kore|puck|zephyr|male|female)\b/gi, '')
          .replace(/\b(?:female|male)\s+voice\b/gi, '')
          .replace(/\b(?:fenrir|charon|kore|puck|zephyr)\b/gi, '')
          .replace(/^\s*[,;.:-]+\s*/, '')
          .replace(/\s*[,;.:-]+\s*$/, '')
          .trim();
        if (!currentStyle) {
          currentStyle = 'Measured historical delivery';
        }
      } else {
        currentStyle = rawStyle;
      }
      continue;
    }

    // 6. Detect Voice/Speaker Heading with VOICE or CHARACTER prefix:
    // e.g. "VOICE 1 — NARRATOR:", "VOICE 2 — VIKRAMADITYA(IA):", "VOICE 2 - VIKRAMADITYA:"
    const voicePrefixMatch = line.match(/^(?:VOICE|CHARACTER|SPEAKER)\s*\d*\s*[-—–:]\s*([A-Za-z0-9\s._'()/-]+?)\s*:\s*(.*)$/i);
    if (voicePrefixMatch) {
      commitTurn();
      commitContext();
      inContextBlock = false;

      let extractedSpeakerRaw = voicePrefixMatch[1].trim();

      // Check for (IA) / (NO_NAME) or (SAY_NAME) flags
      // IA = Inactive Announcement: switch voice without reading character's name aloud
      let isInactiveAnnouncement = /\((?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME)\)/i.test(extractedSpeakerRaw);
      let isExplicitSayName = /\((?:SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\)/i.test(extractedSpeakerRaw);

      // Check if speaker tag specifies voice/gender, e.g. (Male, Charon)
      const hasVoiceInSpeaker = /(?:female|woman|queen|kore|male|baritone|bass|grave|tenor|puck|charon|fenrir|zephyr)/i.test(extractedSpeakerRaw);

      let cleanSpeaker = extractedSpeakerRaw
        .replace(/\((?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME|SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\)/gi, '')
        .replace(/\((?:[^)]+)\)/g, '') // remove extra parens like (Male, Charon)
        .replace(/^(?:VOICE|SPEAKER|CHARACTER)\s*\d*\s*[-—–:]\s*/i, '')
        .trim()
        .toUpperCase();

      currentSpeaker = cleanSpeaker;

      if (hasVoiceInSpeaker && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(extractedSpeakerRaw);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `In Speaker Tag (${detectedVoice})`;
      }

      // Name announcement logic:
      // Narrator speaks text directly unless explicitly asked to announce
      // Characters announce name unless marked with (IA)
      const isNarrator = cleanSpeaker === 'NARRATOR' || cleanSpeaker === 'CHRONICLER';
      if (isNarrator) {
        currentVocalizeName = isExplicitSayName ? true : false;
      } else {
        currentVocalizeName = isInactiveAnnouncement ? false : true;
      }

      const inlineDialogue = voicePrefixMatch[2].trim();
      if (inlineDialogue) {
        currentDialogueLines.push(inlineDialogue);
      }
      continue;
    }

    // 7. Detect General Speaker Line with Colon:
    // e.g. "NARRATOR:", "VIKRAMADITYA(IA):", "VIKRAMADITYA:", "CAESAR (with calm authority):"
    const generalColonMatch = line.match(/^([A-Za-z0-9\s._'()/-]{2,35})\s*(?:\(([^)]+)\)|\[([^\]]+)\])?:\s*(.*)$/);
    const nonSpeakerWords = /^(https?|scene|act|context|note|description|stage|atmosphere|audio|take|dialogue|voice|style|gender|delivery)$/i;

    if (generalColonMatch && !nonSpeakerWords.test(generalColonMatch[1].trim())) {
      commitTurn();
      commitContext();
      inContextBlock = false;

      let candidateRaw = generalColonMatch[1].trim();
      let isInactiveAnnouncement = /\((?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME)\)/i.test(candidateRaw);
      let isExplicitSayName = /\((?:SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\)/i.test(candidateRaw);

      const hasVoiceInSpeaker = /(?:female|woman|queen|kore|male|baritone|bass|grave|tenor|puck|charon|fenrir|zephyr)/i.test(candidateRaw);

      let cleanSpeaker = candidateRaw
        .replace(/\((?:IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME|SAY_NAME|ANNOUNCE|VOCALIZE|NAME)\)/gi, '')
        .replace(/\((?:[^)]+)\)/g, '')
        .trim()
        .toUpperCase();

      currentSpeaker = cleanSpeaker;

      if (hasVoiceInSpeaker && !characterExplicitVoices[cleanSpeaker]) {
        const detectedVoice = parseVoiceDescriptor(candidateRaw);
        characterExplicitVoices[cleanSpeaker] = detectedVoice;
        characterVoiceSources[cleanSpeaker] = `In Speaker Tag (${detectedVoice})`;
      }

      const isNarrator = cleanSpeaker === 'NARRATOR' || cleanSpeaker === 'CHRONICLER';
      if (isNarrator) {
        currentVocalizeName = isExplicitSayName ? true : false;
      } else {
        currentVocalizeName = isInactiveAnnouncement ? false : true;
      }

      const inlineEmotion = (generalColonMatch[2] || generalColonMatch[3] || '').trim();
      if (inlineEmotion && !/^(IA|NO_NAME|SILENT|DIRECT|MUTED?_NAME|SAY_NAME|ANNOUNCE|VOCALIZE|NAME)$/i.test(inlineEmotion)) {
        // Also check if inline emotion has voice keywords
        if (/(?:female|male|kore|fenrir|charon|puck|zephyr)/i.test(inlineEmotion) && !characterExplicitVoices[cleanSpeaker]) {
          const detectedVoice = parseVoiceDescriptor(inlineEmotion);
          characterExplicitVoices[cleanSpeaker] = detectedVoice;
          characterVoiceSources[cleanSpeaker] = `From Tag (${detectedVoice})`;
        }
        currentStyle = inlineEmotion;
      }

      const inlineDialogue = generalColonMatch[4].trim();
      if (inlineDialogue) {
        currentDialogueLines.push(inlineDialogue);
      }
      continue;
    }

    // 8. Quoted Dialogue: e.g. "The news from the southern territories had reached the imperial court."
    if (/^["“].+["”]?$/.test(line)) {
      inContextBlock = false;
      if (!currentSpeaker) {
        currentSpeaker = 'NARRATOR';
        currentVocalizeName = false;
      }
      currentDialogueLines.push(line);
      continue;
    }

    // 9. If we have an active speaker and we're not in a context block, this line is spoken dialogue!
    if (currentSpeaker && !inContextBlock) {
      currentDialogueLines.push(line);
      continue;
    }

    // 10. If currently in context block, accumulate context
    if (inContextBlock) {
      currentContextLines.push(line);
      continue;
    }

    // 11. Otherwise, accumulate as context/atmosphere
    currentContextLines.push(line);
  }

  // Final commits
  commitTurn();
  commitContext();

  // If a scene has no dialogue turns, but accumulated context, convert context into NARRATOR turns
  for (const scene of scenes) {
    if (scene.dialogueTurns.length === 0 && scene.context.trim()) {
      const paragraphs = scene.context
        .split('\n\n')
        .map((p) => p.trim())
        .filter(Boolean);

      const speakerName = 'NARRATOR';
      characterNamesSet.add(speakerName);

      scene.dialogueTurns = paragraphs.map((para) => {
        turnCounter++;
        return {
          id: `turn-${turnCounter}-${Date.now()}`,
          speaker: speakerName,
          text: para.replace(/^["“](.*)["”]$/, '$1').trim(),
          emotion: 'Deep, measured historical narration',
          vocalizeSpeakerName: false,
          status: 'idle',
        };
      });

      scene.context = 'Cinematic historical narration track.';
    }
  }

  // Ensure at least one character exists
  if (characterNamesSet.size === 0) {
    characterNamesSet.add('NARRATOR');
  }

  // Assign voices and persistent baselines
  const detectedCharacters: CharacterVoice[] = Array.from(characterNamesSet).map((name, idx) => {
    let voiceName: GeminiPrebuiltVoice = characterExplicitVoices[name] || PREBUILT_VOICE_ROTATION[idx % PREBUILT_VOICE_ROTATION.length];
    let assignmentSource = characterVoiceSources[name];
    const color = CHARACTER_COLOR_PALETTE[idx % CHARACTER_COLOR_PALETTE.length];
    const upper = name.toUpperCase();

    // If no explicit voice was provided, apply intelligent character archetype detection
    if (!characterExplicitVoices[name]) {
      if (
        upper.includes('QUEEN') ||
        upper.includes('EMPRESS') ||
        upper.includes('LADY') ||
        upper.includes('PRINCESS') ||
        upper.includes('LAKSHMI') ||
        upper.includes('SHANTALA') ||
        upper.includes('ELIZABETH') ||
        upper.includes('MARY') ||
        upper.includes('JOAN') ||
        upper.includes('CLEOPATRA') ||
        upper.includes('FEMALE')
      ) {
        voiceName = 'Kore'; // Female Mezzo-Soprano
        assignmentSource = 'Archetype (Female Sovereign -> Kore)';
      } else if (
        upper.includes('VIKRAMADITYA') ||
        upper.includes('EMPEROR') ||
        upper.includes('KING') ||
        upper.includes('CAESAR') ||
        upper.includes('GENERAL')
      ) {
        voiceName = 'Fenrir'; // Deep Baritone
        assignmentSource = 'Archetype (Imperial Ruler -> Fenrir)';
      } else if (
        upper.includes('PRIEST') ||
        upper.includes('JUDGE') ||
        upper.includes('INQUISITOR') ||
        upper.includes('CHARON')
      ) {
        voiceName = 'Charon'; // Grave Bass
        assignmentSource = 'Archetype (Grave Bass -> Charon)';
      } else if (
        upper.includes('CONSPIRATOR') ||
        upper.includes('MESSENGER') ||
        upper.includes('BRUTUS') ||
        upper.includes('PUCK')
      ) {
        voiceName = 'Puck'; // Agile Tenor
        assignmentSource = 'Archetype (Agile Tenor -> Puck)';
      } else if (upper.includes('NARRATOR') || upper.includes('CHRONICLER')) {
        voiceName = 'Fenrir'; // Deep Narrator
        assignmentSource = 'Documentary Narrator (Fenrir)';
      } else {
        assignmentSource = `Studio Cast Rotation (${voiceName})`;
      }
    }

    let defaultPersonality = 'Measured historical delivery, resonant cinematic voice.';
    if (upper.includes('NARRATOR') || upper.includes('CHRONICLER')) {
      defaultPersonality = 'Deep, measured, ominous cinematic documentary narrator.';
    } else if (upper.includes('VIKRAMADITYA') || upper.includes('EMPEROR') || upper.includes('KING') || upper.includes('CAESAR')) {
      defaultPersonality = 'Controlled anger. Commanding, deliberate imperial authority.';
    } else if (upper.includes('QUEEN') || upper.includes('LAKSHMI') || upper.includes('ELIZABETH') || upper.includes('SHANTALA')) {
      defaultPersonality = 'Regal sovereign with absolute authority and noble gravity.';
    } else if (upper.includes('CONSPIRATOR') || upper.includes('CASSIUS') || upper.includes('SPY')) {
      defaultPersonality = 'Whispered urgency with suppressed tension and vigilance.';
    } else if (upper.includes('SCHOLAR') || upper.includes('TURING') || upper.includes('CECIL')) {
      defaultPersonality = 'Intellectual gravitas, articulate contemplation and moral conviction.';
    }

    return {
      id: `char-${idx}-${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      name,
      voiceName,
      basePersonality: defaultPersonality,
      assignmentSource,
      color,
    };
  });

  return {
    screenplay: {
      id: `script-${Date.now()}`,
      title,
      periodOrEra: era,
      scenes,
    },
    detectedCharacters,
  };
}
