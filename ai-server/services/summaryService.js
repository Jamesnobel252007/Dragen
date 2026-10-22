const { GoogleGenAI } = require("@google/genai");
const { getAllEmbeddings } = require("./vectorStoreService");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const summarizeDocument = async (filename) => {
  const allChunks = getAllEmbeddings();

  const documentChunks = allChunks.filter(
    (chunk) => chunk.filename === filename
  );

  if (documentChunks.length === 0) {
    throw new Error("No document found with this filename");
  }

  const documentText = documentChunks
    .sort((a, b) => a.chunkIndex - b.chunkIndex)
    .map((chunk) => chunk.text)
    .join("\n\n");

  const prompt = `
You are a document summarizer.

Summarize the following document clearly.

Include:
1. Main purpose
2. Important details
3. Key skills / qualifications if available
4. Short conclusion

Document:
${documentText}

Summary:
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  return response.text;
};

module.exports = { summarizeDocument };