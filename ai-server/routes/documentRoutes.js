const express = require("express");
const router = express.Router();

const upload = require("../middleware/uploadMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const { extractTextFromPDF } = require("../services/pdfService");
const { splitTextIntoChunks } = require("../services/chunkService");
const { createEmbeddingsForChunks } = require("../services/embeddingService");
const {
  saveEmbeddings,
  getAllEmbeddings,
} = require("../services/vectorStoreService");

const { searchRelevantChunks } = require("../services/searchService");
const {
  generateAnswer,
  rewriteText,
  summarizeDocumentText,
} = require("../services/llmService");
const { summarizeDocument } = require("../services/summaryService");
const { generateSuggestions } = require("../services/suggestionService");
const { stripHtml } = require("../services/textService");


router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "No file uploaded. Use form-data with key name 'file'."
        });
      }

      const text = await extractTextFromPDF(req.file.path);
      const chunks = splitTextIntoChunks(text);
      const embeddedChunks = await createEmbeddingsForChunks(chunks);
      const savedChunks = saveEmbeddings(req.file.filename, embeddedChunks);
  res.json({
  message: "File processed, embedded, and stored successfully",
  filename: req.file.filename,
  totalChunks: chunks.length,
  storedChunks: savedChunks.length,
  sampleEmbeddingLength: embeddedChunks[0].embedding.length,
});
    } catch (error) {
      res.status(500).json({
        message: "PDF processing failed",
        error: error.message
      });
    }
  }
);

router.post("/ask", authMiddleware, async (req, res) => {
  try {
    const { question, filename } = req.body;

    if (!question) {
      return res.status(400).json({
        message: "Question is required",
      });
    }

    const relevantChunks = await searchRelevantChunks(question, 3, filename);
    const answer = await generateAnswer(question, relevantChunks);
const suggestions = await generateSuggestions(question, answer, relevantChunks);
   
res.json({
  message: "Answer generated successfully",
  mode: filename ? "single-document" : "all-documents",
  filename: filename || "all",
  question,
  answer,
  suggestions,
  sources: relevantChunks.map((chunk) => ({
    filename: chunk.filename,
    chunkIndex: chunk.chunkIndex,
    similarity: chunk.similarity,
    text: chunk.text,
  })),
});
  } catch (error) {
    res.status(500).json({
      message: "Answer generation failed",
      error: error.message,
    });
  }
});

router.post("/summarize", authMiddleware, async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({
        message: "Filename is required",
      });
    }

    const summary = await summarizeDocument(filename);

    res.json({
      message: "Summary generated successfully",
      filename,
      summary,
    });
  } catch (error) {
    res.status(500).json({
      message: "Summary generation failed",
      error: error.message,
    });
  }
});


router.post("/dragen/index", async (req, res) => {
  try {
    const {
      documentId,
      filename,
      content,
    } = req.body;

    if (!documentId) {
      return res.status(400).json({
        message: "documentId is required",
      });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Document content is required",
      });
    }

    const plainText = stripHtml(content);

    if (!plainText) {
      return res.status(400).json({
        message: "Document contains no readable text",
      });
    }

    const chunks = splitTextIntoChunks(plainText);

    if (!chunks.length) {
      return res.status(400).json({
        message: "Unable to create document chunks",
      });
    }

    const embeddedChunks =
      await createEmbeddingsForChunks(chunks);

    const savedChunks = saveEmbeddings(
      documentId,
      filename || `document-${documentId}`,
      embeddedChunks
    );

    return res.status(200).json({
      message: "Dragen document indexed successfully",
      documentId: String(documentId),
      filename: filename || `document-${documentId}`,
      totalChunks: chunks.length,
      storedChunks: savedChunks.length,
      sampleEmbeddingLength:
        embeddedChunks[0]?.embedding?.length || 0,
    });
  } catch (error) {
    console.error("Dragen indexing error:", error);

    return res.status(500).json({
      message: "Dragen document indexing failed",
      error: error.message,
    });
  }
});


router.post("/dragen/ask", async (req, res) => {
  try {
    const {
      documentId,
      question,
      content,
    } = req.body;

    if (!documentId) {
      return res.status(400).json({
        message: "documentId is required",
      });
    }

    if (!question || !question.trim()) {
      return res.status(400).json({
        message: "Question is required",
      });
    }

    let relevantChunks = await searchRelevantChunks(
      question,
      4,
      documentId
    );

    // If not indexed yet, but content was provided, auto-index on the fly!
    if (!relevantChunks.length && content && content.trim()) {
      try {
        const plainText = stripHtml(content);
        if (plainText) {
          const chunks = splitTextIntoChunks(plainText);
          if (chunks.length > 0) {
            const embeddedChunks = await createEmbeddingsForChunks(chunks);
            saveEmbeddings(documentId, `document-${documentId}`, embeddedChunks);
            relevantChunks = await searchRelevantChunks(question, 4, documentId);
          }
        }
      } catch (idxErr) {
        console.warn("Auto-index fallback note:", idxErr.message);
      }
    }

    // If still no chunks, but content is present, construct on-the-fly chunk
    if (!relevantChunks.length && content && content.trim()) {
      const plainText = stripHtml(content);
      relevantChunks = [
        {
          documentId,
          filename: `document-${documentId}`,
          chunkIndex: 0,
          similarity: 1.0,
          text: plainText.slice(0, 12000),
        },
      ];
    }

    if (!relevantChunks.length) {
      return res.status(404).json({
        message: "This document has not been indexed yet and contains no readable text.",
      });
    }

    const answer = await generateAnswer(
      question,
      relevantChunks
    );

    let suggestions = [];
    try {
      suggestions = await generateSuggestions(
        question,
        answer,
        relevantChunks
      );
    } catch {
      suggestions = [];
    }

    return res.status(200).json({
      message: "Answer generated successfully",
      documentId: String(documentId),
      question,
      answer,
      suggestions: Array.isArray(suggestions) ? suggestions : [],
      sources: relevantChunks.map((chunk) => ({
        documentId: chunk.documentId,
        filename: chunk.filename,
        chunkIndex: chunk.chunkIndex,
        similarity: chunk.similarity,
        text: chunk.text,
      })),
    });
  } catch (error) {
    console.error("Dragen AI error:", error);

    return res.status(500).json({
      message: "Answer generation failed",
      error: error.message,
    });
  }
});

// Writing Assistant: Rewrite / Transform selection
router.post("/dragen/rewrite", async (req, res) => {
  try {
    const { text, action, instruction } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({
        message: "Text is required for writing assistance.",
      });
    }

    const result = await rewriteText(text, action, instruction);

    return res.status(200).json({
      message: "Text transformation generated successfully",
      originalText: text,
      replacement: result.replacement,
      explanation: result.explanation,
    });
  } catch (error) {
    console.error("Dragen AI rewrite error:", error);
    return res.status(500).json({
      message: "Writing assistance failed",
      error: error.message,
    });
  }
});

// Document Summarizer
router.post("/dragen/summarize", async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({
        message: "Content is required for summarization.",
      });
    }

    const plainText = stripHtml(content);
    const summary = await summarizeDocumentText(plainText);

    return res.status(200).json({
      message: "Summary generated successfully",
      summary,
    });
  } catch (error) {
    console.error("Dragen AI summarize error:", error);
    return res.status(500).json({
      message: "Document summarization failed",
      error: error.message,
    });
  }
});

module.exports = router;