import { EMBED_BATCH_SIZE } from "./chunk";
import { openrouter } from "./openrouter";

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const model = process.env.EMBED_MODEL;
  if (!model) {
    throw new Error("Missing EMBED_MODEL");
  }

  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBED_BATCH_SIZE);
    const response = await openrouter.embeddings.create({
      model,
      input: batch,
    });

    const ordered = response.data
      .slice()
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    if (ordered.length !== batch.length) {
      throw new Error(
        `Embedding batch mismatch: expected ${batch.length}, got ${ordered.length}`,
      );
    }

    embeddings.push(...ordered);
  }

  return embeddings;
}
