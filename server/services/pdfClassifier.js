const fs = require('fs');
const pdfParse = require('pdf-parse');

/**
 * Parse a PDF file and extract:
 * - doc_type_id: auto-classified document type (2=ใบตรวจสอบสิทธิ์, 3=Authen Code, null=unknown)
 * - extractedText: full text content from the PDF
 * - extractedCid: 13-digit Thai citizen ID found in the text (if any)
 */
async function parsePdf(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        const text = data.text || '';

        // --- Classify document type ---
        let docTypeId = null;
        if (text.includes('สิทธิ์ที่ใช้เบิก') || text.includes('สิทธิที่ใช้เบิก')) {
            docTypeId = 2; // ใบตรวจสอบสิทธิ์
        } else if (/authen\s*code/i.test(text)) {
            docTypeId = 3; // Authen Code
        }

        // --- Extract CID (13-digit number) ---
        // Thai CID is exactly 13 digits. We look for standalone 13-digit sequences.
        // Common patterns: "1-1234-12345-12-1" or "1123412345121" or with spaces
        let extractedCid = null;

        // First try: find 13 consecutive digits
        const cidMatch = text.replace(/[\s\-\.]/g, '').match(/\d{13}/);
        if (cidMatch) {
            extractedCid = cidMatch[0];
        }

        // If not found, try patterns like "X-XXXX-XXXXX-XX-X"
        if (!extractedCid) {
            const dashPattern = text.match(/(\d[\-\s]*){13}/);
            if (dashPattern) {
                const digits = dashPattern[0].replace(/\D/g, '');
                if (digits.length === 13) {
                    extractedCid = digits;
                }
            }
        }

        return {
            docTypeId,
            extractedText: text,
            extractedCid,
        };
    } catch (error) {
        console.error('Error parsing PDF:', error);
        return {
            docTypeId: null,
            extractedText: null,
            extractedCid: null,
        };
    }
}

module.exports = {
    parsePdf,
    // Keep backward-compatible alias
    classifyPdf: async (filePath) => {
        const result = await parsePdf(filePath);
        return result.docTypeId;
    }
};
