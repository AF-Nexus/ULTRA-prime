const fs = require('fs');
const path = require('path');

// Multiple API keys for fallback
const API_KEYS = [
    'CNJgmfg9X745hcnMQ7FE-nDxytt6w8xK',
    'c7Jo_q9xvCMAQsj1qihjLJBMBY2Er5--',
    'KpoS0JysNXgUSgCWH2hr__2OG7aJ30S_',
    'furii3L3ijdpwYB-vZ_jej7CxvNjFESk',
    'PS0uqmRdEQ3mSqNWD28lccEmQMz-eu7',
    '9L_JkdEp6u4yAa3Dwi9gnYxvZ2_HrXj-'
];

/**
 * Uploads content to Pastebin, handling different input types like text, files, and base64 data.
 * @param {string | Buffer} input - The content to upload, can be text, file path, or base64 data.
 * @param {string} [title] - Optional title for the paste.
 * @param {string} [format] - Optional syntax highlighting format (e.g., 'text', 'python', 'javascript').
 * @param {string} [privacy] - Optional privacy setting (0 = public, 1 = unlisted, 2 = private).
 * @returns {Promise} - The custom URL of the created paste.
 */
async function uploadToPastebin(input, title = 'Untitled', format = 'json', privacy = '1') {
    let lastError = null;

    // Try each API key in sequence
    for (let i = 0; i < API_KEYS.length; i++) {
        const PASTEBIN_API_KEY = API_KEYS[i];
        console.log(`Attempting upload with API key ${i + 1}/${API_KEYS.length}...`);

        try {
            // Dynamically import the `pastebin-api` ES module
            const { PasteClient, Publicity } = await import('pastebin-api');

            // Initialize the Pastebin client
            const client = new PasteClient(PASTEBIN_API_KEY);

            // Map privacy settings to `pastebin-api`'s Publicity enum
            const publicityMap = {
                '0': Publicity.Public,
                '1': Publicity.Unlisted,
                '2': Publicity.Private,
            };

            let contentToUpload = '';

            // Detect the type of input and process accordingly
            if (Buffer.isBuffer(input)) {
                // If the input is a Buffer (file content), convert it to string
                contentToUpload = input.toString();
            } else if (typeof input === 'string') {
                if (input.startsWith('data:')) {
                    // If the input is a base64 string, extract the actual base64 data
                    const base64Data = input.split(',')[1];
                    contentToUpload = Buffer.from(base64Data, 'base64').toString();
                } else if (input.startsWith('http://') || input.startsWith('https://')) {
                    // If it's a URL, treat it as plain text
                    contentToUpload = input;
                } else if (fs.existsSync(input)) {
                    // If the input is a file path, read the file (assume it's creds.json in this case)
                    contentToUpload = fs.readFileSync(input, 'utf8');
                } else {
                    // Otherwise, treat it as plain text (code snippet or regular text)
                    contentToUpload = input;
                }
            } else {
                throw new Error('Unsupported input type. Please provide text, a file path, or base64 data.');
            }

            // Upload the paste
            const pasteUrl = await client.createPaste({
                code: contentToUpload,
                expireDate: 'N', // Never expire
                format: format, // Syntax highlighting format (set to 'json')
                name: title, // Title of the paste
                publicity: publicityMap[privacy], // Privacy setting
            });

            console.log('Original Pastebin URL:', pasteUrl);

            // Manipulate the URL: Remove 'https://pastebin.com/' and prepend custom words
            const pasteId = pasteUrl.replace('https://pastebin.com/', '');
            const customUrl = `EF-PRIME-MD_${pasteId}`;

            console.log('Custom URL:', customUrl);

            // Return the custom URL
            return customUrl;

        } catch (error) {
            console.error(`Error uploading to Pastebin with API key ${i + 1}:`, error);
            lastError = error;

            // If this isn't the last API key, continue to the next one
            if (i < API_KEYS.length - 1) {
                console.log(`Trying next API key...`);
                continue;
            }
        }
    }

    // If all API keys failed, throw the last error
    throw lastError;
}

module.exports = uploadToPastebin;
