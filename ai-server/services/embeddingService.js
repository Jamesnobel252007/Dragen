const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const createEmbedding = async (text) => {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });

  return response.embeddings[0].values;
};

const createEmbeddingsForChunks = async (chunks) => {
  const embeddedChunks = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await createEmbedding(chunks[i]);

    embeddedChunks.push({
      chunkIndex: i,
      text: chunks[i],
      embedding,
    });
  }

  return embeddedChunks;
};

module.exports = {
  createEmbedding,
  createEmbeddingsForChunks,
};