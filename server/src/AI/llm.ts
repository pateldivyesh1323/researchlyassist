import { ChatGroq } from '@langchain/groq';

export const createLLM = (options?: { streaming?: boolean; temperature?: number }) => {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    temperature: options?.temperature ?? 0.3,
    streaming: options?.streaming ?? true,
  });
};
