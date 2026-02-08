import { PDFParse } from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';

export const extractTextFromPdf = async (url: string): Promise<string> => {
  const parser = new PDFParse({ url });
  const result = await parser.getText();
  return result.text;
};

export const splitTextIntoChunks = async (
  text: string,
  metadata: Record<string, unknown> = {}
): Promise<Document[]> => {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  return splitter.createDocuments([text], [metadata]);
};

export const processPdf = async (
  url: string,
  metadata: Record<string, unknown> = {}
): Promise<{ text: string; chunks: Document[] }> => {
  const text = await extractTextFromPdf(url);
  const chunks = await splitTextIntoChunks(text, metadata);
  return { text, chunks };
};
