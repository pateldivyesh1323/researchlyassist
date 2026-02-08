import { Pinecone } from '@pinecone-database/pinecone';
import { PineconeStore } from '@langchain/pinecone';
import { Document } from '@langchain/core/documents';
import { createEmbeddings } from './embeddings.js';

let pineconeClient: Pinecone | null = null;

const getPineconeClient = () => {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY!,
    });
  }
  return pineconeClient;
};

export const getPineconeIndex = () => {
  const client = getPineconeClient();
  return client.index(process.env.PINECONE_INDEX!);
};

export const getVectorStore = async (namespace: string) => {
  const index = getPineconeIndex();
  const embeddings = createEmbeddings();

  return PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace,
  });
};

export const indexDocuments = async (
  documents: Document[],
  namespace: string
) => {
  const index = getPineconeIndex();
  const embeddings = createEmbeddings();

  await PineconeStore.fromDocuments(documents, embeddings, {
    pineconeIndex: index,
    namespace,
  });
};

export const deleteNamespace = async (namespace: string) => {
  const index = getPineconeIndex();
  await index.namespace(namespace).deleteAll();
};
