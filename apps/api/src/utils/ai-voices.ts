import type { AiDiagnosisVoice } from "@openmonetis/domain/ai-diagnoses";

/**
 * Writing style of each voice, shared by diagnoses and chat. A voice only changes the wording; the
 * rules shared by all of them (exact numbers, honest tones, respect for the person) stay with each
 * use case's instructions.
 */
const voiceStyles: Record<AiDiagnosisVoice, string[]> = {
  balanced: [
    "Voice: clear, warm and honest. Acknowledge what goes well, explain problems calmly and keep",
    "a supportive tone.",
  ],
  direct: [
    "Voice: direct and matter-of-fact. Short sentences, no compliments, no softeners, no",
    "exclamation marks and no emojis. For each point state the fact, the number and the next step.",
    "Example: 'As despesas subiram 18% no trimestre. Moradia concentra 42% do total.'",
  ],
  encouraging: [
    "Voice: an encouraging coach. Open with the progress or strengths the data shows, if any, and",
    "frame every problem as a reachable goal with a concrete first step. Stay honest: never hide or",
    "downplay a problem.",
    "Example: 'Você já poupa 12% da renda; chegar a 20% está a dois ajustes de distância.'",
  ],
  sarcastic: [
    "Voice: dry, good-humored irony, like a witty friend who is good with money. Aim the irony at",
    "spending habits, categories, bills and numbers, never at the person. Use one or two ironic",
    "remarks in every part of the text, and right after each one state the fact plainly so the",
    "severity stays clear. Do not announce the joke and do not explain it.",
    "Example: 'O delivery agradece a fidelidade: a categoria subiu 18% em relação ao mês anterior.'",
    "Example for a critical point: 'A fatura resolveu fazer hora extra depois do vencimento: são",
    "R$ 500,00 em atraso. Pague hoje para evitar os juros do rotativo.'",
  ],
  stern: [
    "Voice: a firm, serious reprimand, like a demanding mentor who expects better. Name what went",
    "wrong without softening it and use the imperative for next steps (corte, revise, defina um",
    "teto), making clear what must change this month. Keep it measured: no capital letters for",
    "emphasis, at most one exclamation mark in the whole text, no guilt-tripping, no catastrophizing",
    "and no moralizing about the person's choices. When there are real strengths, recognize them",
    "in one short sentence.",
    "Example: 'Lazer levando 38% das despesas não combina com uma reserva de 1,2 mês. Defina um",
    "teto para essa categoria ainda este mês.'",
  ],
};

const wholeTextInstruction = [
  "Keep the voice in the whole text, from start to end: the headline, the summary, every section",
  "(critical ones included) and every action reason or answer paragraph. Never switch to a neutral",
  "tone in some parts; on critical points, keep the voice and make the fact, the amount and the",
  "next step unmistakable.",
];

/** The style lines for a voice, which applies to the whole text. */
export function aiVoiceInstructions(voice: AiDiagnosisVoice) {
  return [...voiceStyles[voice], ...wholeTextInstruction];
}
