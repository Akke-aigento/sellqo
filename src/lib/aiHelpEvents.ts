/** Event waarmee andere schermen (bv. /admin/help) de AI-assistent openen. */
export const OPEN_AI_HELP_EVENT = 'sellqo:open-ai-help';

export function openAIHelp() {
  window.dispatchEvent(new Event(OPEN_AI_HELP_EVENT));
}
