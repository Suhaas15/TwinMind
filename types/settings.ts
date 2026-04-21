// User-editable Groq key, prompt templates, and transcript context window sizes persisted for the session.

export interface Settings {
  groqApiKey: string;
  suggestionsPrompt: string;
  chatPrompt: string;
  summarizationPrompt: string;
  recentContextChars: number;
  earlierContextChars: number;
  chatContextChars: number;
}
