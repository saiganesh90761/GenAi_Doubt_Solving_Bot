export type KnowledgeScope = "global" | "private";

export type VectorChunkPayload = {
  chunkId: string;
  documentId: string;
  documentName: string;
  text: string;
  page: number;
  subject: string;
  documentType: string;
  ownerId?: string | null;
  knowledgeScope: KnowledgeScope;
  createdAt?: number;
  [key: string]: unknown;
};

export type IndexRecord = {
  id: string;
  text: string;
  file: string;
  page: number;
  embedding: number[];
  subject?: string;
  documentType?: string;
  documentId?: string;
  ownerId?: string | null;
  knowledgeScope?: KnowledgeScope;
};

export type ChatSource = {
  file: string;
  page: number;
  snippet: string;
  score?: number;
  subject?: string;
  knowledgeScope?: KnowledgeScope;
};
