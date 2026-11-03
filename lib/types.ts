export type IndexRecord = {
  id: string;
  text: string;
  file: string;
  page: number;
  embedding: number[];
};

export type ChatSource = {
  file: string;
  page: number;
  snippet: string;
};
