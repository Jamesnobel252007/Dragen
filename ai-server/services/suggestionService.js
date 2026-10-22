const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const generateSuggestions = async (question, answer, relevantChunks) => {
  const context = relevantChunks
    .map((chunk) => chunk.text)
    .join("\n\n");

  const prompt = `
You are helping a user explore an uploaded document.

Based on the user's question, answer, and document context, suggest 3 useful follow-up questions.

Return ONLY the questions as a JSON array of strings.
No explanation.

User question:
${question}

Answer:
${answer}

Document context:
${context}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text.trim();

  try {
    return JSON.parse(text);
  } catch {
    return text
      .split("\n")
      .map((line) => line.replace(/^\d+\.|-|\*/g, "").trim())
      .filter(Boolean)
      .slice(0, 3);
  }
};

module.exports = { generateSuggestions };