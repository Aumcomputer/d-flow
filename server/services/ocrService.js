const Tesseract = require('tesseract.js');

async function extractTextFromImage(filePath) {
    try {
        const { data: { text } } = await Tesseract.recognize(
            filePath,
            'eng',
            { logger: () => {} }
        );
        return text || '';
    } catch (error) {
        console.error('OCR Error:', error);
        return '';
    }
}

async function extractCidFromImage(filePath) {
    const text = await extractTextFromImage(filePath);
    if (!text) return null;

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

    return extractedCid;
}

module.exports = {
    extractCidFromImage
};
