import { Embeddings, type EmbeddingsParams } from '@langchain/core/embeddings';
import { Pinecone } from '@pinecone-database/pinecone';

class PineconeEmbeddings extends Embeddings {
  private client: Pinecone;
  private model: string;

  constructor(params?: EmbeddingsParams & { model?: string }) {
    super(params ?? {});
    this.client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
    this.model = params?.model ?? 'multilingual-e5-large';
  }

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const batchSize = 96;
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const response = await this.client.inference.embed(
        this.model,
        batch,
        { inputType: 'passage' }
      );
      for (const item of response.data) {
        allEmbeddings.push('values' in item ? item.values : []);
      }
    }

    return allEmbeddings;
  }

  async embedQuery(query: string): Promise<number[]> {
    const response = await this.client.inference.embed(
      this.model,
      [query],
      { inputType: 'query' }
    );
    const item = response.data[0];
    if ('values' in item) {
      return item.values;
    }
    return [];
  }
}

export const createEmbeddings = () => {
  return new PineconeEmbeddings();
};
