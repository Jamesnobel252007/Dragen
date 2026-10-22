const fs = require("fs");
const pdfParse = require("pdf-parse");

const extractTextFromPDF = async (filePath) => {
  const fileBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(fileBuffer);
  return data.text;
};

module.exports = { extractTextFromPDF };