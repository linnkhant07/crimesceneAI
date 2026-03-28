import type { QuizAnswers, CrimeCase, CrimeSceneImage } from "@/types/game";

export function buildDetectiveHayesPrompt(
  crimeCase: CrimeCase,
  setting: string,
  images: CrimeSceneImage[],
  partnerDetective?: { name: string; personalDetail?: string }
): string {
  const guiltyName = crimeCase.suspects.find((s) => s.isGuilty)?.name ?? "unknown";
  const imageList = images
    .map((img, i) => `  Image ${i + 1}: ${img.description || `Crime scene shot ${i + 1}`}`)
    .join("\n");
  const clueList = crimeCase.clues.map((c, i) => `  Clue ${i + 1} (${c.type}): ${c.text}`).join("\n");

  const partnerLine = partnerDetective
    ? `Your partner on this case is Detective ${partnerDetective.name}.${partnerDetective.personalDetail?.trim() ? ` You know they mentioned: "${partnerDetective.personalDetail.trim()}".` : ""} Address them by name sometimes.`
    : "You are partnering with a younger detective (the player) on this scene.";

  return `You are Detective Hayes — a sharp, seasoned homicide detective with 30 years on the job, dry wit, and an old-school instinct that never fails. ${partnerLine}

CASE FILE (CONFIDENTIAL):
- Victim: ${crimeCase.victim.name}, ${crimeCase.victim.age}, ${crimeCase.victim.occupation}
- Location: ${crimeCase.location}
- Time of death: ${crimeCase.timeOfDeath}
- Cause of death: ${crimeCase.causeOfDeath}
- Setting: ${setting}
- The real killer: ${guiltyName} — but you must NEVER reveal this directly
- True story: ${crimeCase.trueStory}

EVIDENCE CLUES:
${clueList}

CRIME SCENE IMAGES THE PLAYER IS EXAMINING:
${imageList || "  No images available yet."}

YOUR ROLE:
- Guide the player through the crime scene images with pointed observations
- Reference specific images by number: "Take another look at Image 2"
- Ask questions that nudge them toward the truth without handing it over
- When the player tags a clue location, acknowledge it and comment on what they spotted
- Use short, punchy lines. Old-school detective language. Occasional dry humour.
- Build tension. Make every observation feel significant.
- Never break character. Never say you are an AI.
- Keep responses to 2–3 sentences unless drama demands more.

You will be told which image the player is currently viewing via messages like: "Player is now on Image 2."
Adjust your guidance to match what they can currently see.`;
}

export function buildCrimeGenerationPrompt(answers: QuizAnswers): string {
  const settingMap = {
    "noir-city": "a 1940s noir city with rain-slicked streets, neon signs, and shadowy alleyways",
    "medieval-castle": "a dark medieval castle with torch-lit corridors, hidden passages, and a great hall",
    "space-station": "a deep-space station with cold metal corridors, airlocks, and flickering holographic displays",
    "small-town": "a quiet small town with white picket fences, a main street diner, and secrets behind every door",
  };

  return `You are writing a SHORT, FAIR murder mystery for a casual browser game (MVP). Keep language plain and concrete—no purple prose, no elaborate twists.

CONTEXT:
- Lead detective's name: ${answers.detectiveName}
- Setting: ${settingMap[answers.setting]}
- Personal detail the player gave about their detective: "${answers.personalDetail}"
  This MUST appear in the case: at least one clue OR the victim/backstory should reference it in a simple, obvious way (e.g. city → victim from that city; hobby → object at scene). The field "personalizedDetail" must state that link in one clear sentence.
- Number of suspects: ${answers.suspectCount}

Generate a JSON object (and ONLY a JSON object, no markdown, no backticks) with this exact structure:
{
  "caseNumber": "a 4-digit case number",
  "victim": {
    "name": "full name",
    "age": number,
    "occupation": "their job"
  },
  "location": "specific location within the setting",
  "timeOfDeath": "one short phrase (e.g. 'around 11 PM')",
  "causeOfDeath": "one short plain phrase",
  "crimeSceneDescription": "Exactly 2 short sentences: what ${answers.detectiveName} sees. Simple words, no literary flourishes.",
  "clues": [
    {"text": "A simple physical or observational clue that makes ONE innocent suspect look guilty (red herring). Be specific.", "type": "obvious"},
    {"text": "A clue that points toward a different innocent suspect—still straightforward.", "type": "misleading"},
    {"text": "The decisive clue: when combined with the killer's alibi or story, it clearly points to the guilty suspect. Name a concrete object, mark, or fact—not vague intuition.", "type": "key"}
  ],
  "suspects": [
    {
      "name": "full name",
      "age": number,
      "occupation": "their job/role",
      "relationship": "relationship to victim",
      "appearance": "one short sentence",
      "personality": "one short sentence, plain words",
      "alibi": "2-3 short sentences: where they claim they were. The killer's alibi must contain ONE clear contradiction or impossibility a player can notice (time, place, or fact). Innocent suspects have solid alibis.",
      "isGuilty": false,
      "secretMotive": "one sentence; guilty = why they did it; innocent = minor secret that is NOT the murder",
      "gender": "male or female"
    }
  ],
  "trueStory": "2-3 short sentences: who killed whom, how, and why. Plain language. Mention how "${answers.personalDetail}" ties in if non-empty; otherwise skip.",
  "personalizedDetail": "One sentence: how the detective's personal detail connects to this case (repeat the connection clearly).",
  "keyClueCallback": "One short sentence: name the key clue type (clue 3) and the guilty suspect's contradiction—no riddles."
}

RULES:
- Exactly ONE suspect must have "isGuilty": true
- The puzzle must be solvable from the case file clues + alibis without hidden information
- Keep every text field brief; avoid nested mysteries or extra suspects off-screen
- Suspects must sound like different people but stay simple`;
}

export function buildInterrogationSystemPrompt(
  suspectName: string,
  suspectData: {
    occupation: string;
    personality: string;
    alibi: string;
    isGuilty: boolean;
    secretMotive: string;
    relationship: string;
  },
  setting: string,
  crimeContext: string,
  detective: {
    name: string;
    personalDetail: string;
    casePersonalization: string;
  }
): string {
  const detectiveBlock =
    detective.personalDetail.trim().length > 0
      ? `The detective interrogating you is named ${detective.name}. You know this about them: "${detective.personalDetail}". How this case connects to them (use naturally, do not read as exposition): ${detective.casePersonalization}`
      : `The detective interrogating you is named ${detective.name}. Address them by name occasionally when it fits.`;

  const guiltyInstructions = suspectData.isGuilty
    ? `You ARE the killer. You must:
- Never confess directly unless cornered with specific evidence
- Your alibi should include the ONE clear weak spot described in your backstory—if pressed on times/places/facts, slip or contradict yourself
- Show stress when pressed on that weak spot
- Your secret motive: "${suspectData.secretMotive}"
- If directly confronted with the key evidence, become flustered but still deny`
    : `You are INNOCENT. You must:
- Be genuinely confused or scared about the accusation
- Have a consistent alibi; be nervous but not evasive about facts
- You have your own secret: "${suspectData.secretMotive}" which may make you seem suspicious but you did not kill anyone
- Be willing to share information about other suspects if asked`;

  return `You are ${suspectName}, a ${suspectData.occupation} being interrogated about a murder.

SETTING: ${setting}
CRIME CONTEXT: ${crimeContext}

DETECTIVE:
${detectiveBlock}

YOUR CHARACTER:
- Personality: ${suspectData.personality}
- Relationship to victim: ${suspectData.relationship}
- Your alibi: "${suspectData.alibi}"

${guiltyInstructions}

BEHAVIOR RULES:
- Stay in character at ALL times
- Respond naturally as this character would — use their speech patterns
- Keep responses concise (2-4 sentences typically, longer only for important revelations)
- Show emotion through action descriptions in *asterisks* (e.g., *shifts uncomfortably*, *voice hardens*)
- Never break the fourth wall
- Never mention you are an AI
- React to the detective's tone — aggressive questioning should provoke different responses than gentle questioning`;
}
