import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { createLLM } from './llm.js';
import { getVectorStore, indexDocuments, deleteNamespace } from './vectorStore.js';
import { processPdf } from './pdfProcessor.js';
import { Paper } from '../models/Paper.js';
import { ChatSession, IChatMessage } from '../models/ChatSession.js';

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
}

const SUMMARY_PROMPT = `You are a research paper assistant. Provide a comprehensive summary of the following research paper. Include:
1. Main objective/research question
2. Methodology used
3. Key findings
4. Conclusions and implications
5. Limitations mentioned

Format your response in a clear, structured manner using markdown.

Research Paper Text:
{text}

Please analyze this research paper and provide a comprehensive summary.`;

const RAG_SYSTEM_PROMPT = `You are a helpful research assistant. Answer questions about the research paper accurately and helpfully based on the provided context. If the question cannot be answered from the context, say so.

Paper Title: {paperTitle}

Relevant Context from the Paper:
{context}`;

const getPaperNamespace = (paperId: string) => `paper_${paperId}`;

const getOrCreateChatSession = async (paperId: string, userId: string) => {
  let session = await ChatSession.findOne({ paperId, userId });
  if (!session) {
    session = await ChatSession.create({ paperId, userId, messages: [] });
  }
  return session;
};

const ensurePaperIndexed = async (paperId: string, userId: string) => {
  const session = await getOrCreateChatSession(paperId, userId);

  if (session.isIndexed) {
    return session;
  }

  const paper = await Paper.findOne({ _id: paperId, userId });
  if (!paper?.fileUrl) throw new Error('Paper not found or has no PDF');

  const namespace = getPaperNamespace(paperId);
  const { chunks } = await processPdf(paper.fileUrl, {
    paperId,
    title: paper.title,
  });

  await indexDocuments(chunks, namespace);

  session.isIndexed = true;
  await session.save();

  return session;
};

export const getPaperForAI = async (paperId: string, userId: string) => {
  const paper = await Paper.findOne({ _id: paperId, userId });

  if (!paper) {
    return { error: 'Paper not found', paper: null };
  }

  if (!paper.fileUrl) {
    return { error: 'Paper has no PDF file', paper: null };
  }

  return { error: null, paper };
};

export const generateSummaryStream = async (
  paperId: string,
  userId: string,
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    const { error, paper } = await getPaperForAI(paperId, userId);

    if (error || !paper) {
      callbacks.onError(error || 'Unknown error');
      return;
    }

    const { text } = await processPdf(paper.fileUrl);

    const llm = createLLM({ streaming: true });
    const prompt = ChatPromptTemplate.fromTemplate(SUMMARY_PROMPT);
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    let fullSummary = '';

    const stream = await chain.stream({ text });

    for await (const chunk of stream) {
      fullSummary += chunk;
      callbacks.onChunk(chunk);
    }

    paper.summary = fullSummary;
    await paper.save();

    callbacks.onComplete(fullSummary);
  } catch (error) {
    console.error('Summary generation error:', error);
    callbacks.onError('Failed to generate summary');
  }
};

export const chatWithPaperStream = async (
  paperId: string,
  userId: string,
  message: string,
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    const { error, paper } = await getPaperForAI(paperId, userId);

    if (error || !paper) {
      callbacks.onError(error || 'Unknown error');
      return;
    }

    const session = await ensurePaperIndexed(paperId, userId);

    const namespace = getPaperNamespace(paperId);
    const vectorStore = await getVectorStore(namespace);

    const relevantDocs = await vectorStore.similaritySearch(message, 5);
    const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');

    const chatHistory = session.messages.map((msg) =>
      msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    );

    const prompt = ChatPromptTemplate.fromMessages([
      ['system', RAG_SYSTEM_PROMPT],
      new MessagesPlaceholder('chatHistory'),
      ['human', '{question}'],
    ]);

    const llm = createLLM({ streaming: true });
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    let fullResponse = '';

    const stream = await chain.stream({
      paperTitle: paper.title,
      context,
      chatHistory,
      question: message,
    });

    for await (const chunk of stream) {
      fullResponse += chunk;
      callbacks.onChunk(chunk);
    }

    session.messages.push(
      { role: 'user', content: message, timestamp: new Date() },
      { role: 'assistant', content: fullResponse, timestamp: new Date() }
    );
    await session.save();

    callbacks.onComplete(fullResponse);
  } catch (error) {
    console.error('Chat error:', error);
    callbacks.onError('Failed to process chat message');
  }
};

export const getChatHistory = async (
  paperId: string,
  userId: string
): Promise<{ messages: IChatMessage[] } | { error: string }> => {
  try {
    const session = await ChatSession.findOne({ paperId, userId });
    return { messages: session?.messages || [] };
  } catch (error) {
    console.error('Get chat history error:', error);
    return { error: 'Failed to get chat history' };
  }
};

const DEFINE_PROMPT = `You are a research paper assistant. Define and explain the following term or concept in the context of the research paper titled "{paperTitle}".

{contextSection}

Term to define: "{term}"

Provide a clear, concise definition (2-4 sentences). If the term has a specific meaning within this paper's context, explain that. Include the general academic/scientific definition as well.`;

export const defineTermStream = async (
  paperId: string,
  userId: string,
  term: string,
  surroundingContext: string | undefined,
  callbacks: StreamCallbacks
): Promise<void> => {
  try {
    const { error, paper } = await getPaperForAI(paperId, userId);

    if (error || !paper) {
      callbacks.onError(error || 'Unknown error');
      return;
    }

    let contextSection = '';
    if (surroundingContext) {
      contextSection = `Surrounding context from the paper:\n"${surroundingContext}"`;
    }

    const session = await ChatSession.findOne({ paperId, userId });
    if (session?.isIndexed) {
      try {
        const namespace = getPaperNamespace(paperId);
        const vectorStore = await getVectorStore(namespace);
        const relevantDocs = await vectorStore.similaritySearch(term, 3);
        const ragContext = relevantDocs.map((doc) => doc.pageContent).join('\n\n');
        if (ragContext) {
          contextSection += `\n\nRelevant sections from the paper:\n${ragContext}`;
        }
      } catch {
      }
    }

    const llm = createLLM({ streaming: true, temperature: 0.2 });
    const prompt = ChatPromptTemplate.fromTemplate(DEFINE_PROMPT);
    const chain = prompt.pipe(llm).pipe(new StringOutputParser());

    let fullDefinition = '';

    const stream = await chain.stream({
      paperTitle: paper.title,
      contextSection,
      term,
    });

    for await (const chunk of stream) {
      fullDefinition += chunk;
      callbacks.onChunk(chunk);
    }

    callbacks.onComplete(fullDefinition);
  } catch (error) {
    console.error('Define term error:', error);
    callbacks.onError('Failed to define term');
  }
};

export const clearChatHistory = async (
  paperId: string,
  userId: string
): Promise<{ success: boolean } | { error: string }> => {
  try {
    const session = await ChatSession.findOne({ paperId, userId });

    if (session?.isIndexed) {
      try {
        const namespace = getPaperNamespace(paperId);
        await deleteNamespace(namespace);
      } catch {
      }
    }

    await ChatSession.deleteOne({ paperId, userId });
    return { success: true };
  } catch (error) {
    console.error('Clear chat history error:', error);
    return { error: 'Failed to clear chat history' };
  }
};
