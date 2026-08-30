/** Modello premium xAI usato da tutte le fasi server di Fenix. */
export const FENIX_MODEL = "grok-4.6";

export const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

export const XAI_MISSING_KEY_ERROR = "Manca XAI_API_KEY sul server";

export function getXaiApiKey(): string | null {
  const apiKey = process.env.XAI_API_KEY?.trim();
  return apiKey || null;
}
