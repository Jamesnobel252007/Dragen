const fs = require("fs");
const path = require("path");

const storePath = path.join(__dirname, "../data/vectorStore.json");

const saveEmbeddings = (documentId, filename, embeddedChunks) => {
  let existingData = [];

  if (fs.existsSync(storePath)) {
    const fileData = fs.readFileSync(storePath, "utf-8");
    existingData = fileData ? JSON.parse(fileData) : [];
  }

  // Remove previous embeddings for this Dragen document.
  // This prevents duplicate vectors when the document is re-indexed.
  existingData = existingData.filter(
    (chunk) => String(chunk.documentId) !== String(documentId)
  );

  const documentData = embeddedChunks.map((chunk) => ({
    documentId: String(documentId),
    filename,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    embedding: chunk.embedding,
  }));

  existingData.push(...documentData);

  fs.writeFileSync(
    storePath,
    JSON.stringify(existingData, null, 2)
  );

  return documentData;
};

const getAllEmbeddings = () => {
  if (!fs.existsSync(storePath)) {
    return [];
  }

  const fileData = fs.readFileSync(storePath, "utf-8");

  return fileData ? JSON.parse(fileData) : [];
};

module.exports = {
  saveEmbeddings,
  getAllEmbeddings,
};