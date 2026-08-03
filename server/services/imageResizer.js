const sharp = require('sharp');
const fs = require('fs');

async function resizeImage(inputPath, outputPath, maxWidth = 900) {
    try {
        const metadata = await sharp(inputPath).metadata();
        if (metadata.width > maxWidth) {
            await sharp(inputPath)
                .resize({ width: maxWidth })
                .toFile(outputPath);
        } else {
            fs.copyFileSync(inputPath, outputPath);
        }
        return outputPath;
    } catch (error) {
        console.error('Error resizing image:', error);
        throw error;
    }
}

module.exports = {
    resizeImage
};
