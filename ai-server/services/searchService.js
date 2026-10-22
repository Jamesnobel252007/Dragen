const { createEmbedding } = require("./embeddingService");
const { getAllEmbeddings } = require("./vectorStoreService");

const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
};

const searchRelevantChunks = async (
  question,
  topK = 3,
  documentId = null
) => {
  const questionEmbedding = await createEmbedding(question);

  let storedChunks = getAllEmbeddings();

  // Search only inside the requested Dragen document.
  if (documentId !== null && documentId !== undefined) {
    storedChunks = storedChunks.filter(
      (chunk) => String(chunk.documentId) === String(documentId)
    );
  }

  const rankedChunks = storedChunks.map((chunk) => ({
    ...chunk,
    similarity: cosineSimilarity(
      questionEmbedding,
      chunk.embedding
    ),
  }));

  rankedChunks.sort(
    (a, b) => b.similarity - a.similarity
  );

  return rankedChunks.slice(0, topK);
};

module.exports = {
  searchRelevantChunks,
};