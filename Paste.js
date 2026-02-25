const fs = require('fs');
const fetch = require('node-fetch');

// Multiple API keys for fallback
const API_KEYS = [
    'Pe8nyDTO5Jm4ZdKo3qlbKjaFSP53srbT',
    'c7Jo_q9xvCMAQsj1qihjLJBMBY2Er5--',
    'KpoS0JysNXgUSgCWH2hr__2OG7aJ30S_',
    'furii3L3ijdpwYB-vZ_jej7CxvNjFESk',
    'PS0uqmRdEQ3mSqNWD28lccEmQMz-eu7',
    '9L_JkdEp6u4yAa3Dwi9gnYxvZ2_HrXj-'
];

/**
 * Uploads content to Pastebin using raw HTTP (no ESM dependency issues).
 * @param {string|Buffer} input - Text, file path, or Buffer to upload.
 * @param {string} title - Title for the paste.
 * @param {string} format - Syntax format (e.g. 'json', 'text').
 * @param {string} privacy - '0' public, '1' unlisted, '2' private.
 * @returns {Promise<string>} - Custom session ID string.
 */
async function uploadToPastebin(input, title = 'creds.json', format = 'json', privacy = '1') {
    // Resolve content
    let content = '';

    if (Buffer.isBuffer(input)) {
        content = input.toString('utf8');
    } else if (typeof input === 'string') {
        if (input.startsWith('data:')) {
            // base64 data URL
            const base64Data = input.split(',')[1];
            content = Buffer.from(base64Data, 'base64').toString('utf8');
        } else if (fs.existsSync(input)) {
            // file path
            content = fs.readFileSync(input, 'utf8');
        } else {
            // plain text / URL
            content = input;
        }
    } else {
        throw new Error('Unsupported input type. Provide text, a file path, or a Buffer.');
    }

    if (!content || content.trim() === '') {
        throw new Error('Content to upload is empty.');
    }

    let lastError = null;

    for (let i = 0; i < API_KEYS.length; i++) {
        const apiKey = API_KEYS[i];
        console.log(`[Pastebin] Trying API key ${i + 1}/${API_KEYS.length}...`);

        try {
            const params = new URLSearchParams();
            params.append('api_dev_key', apiKey);
            params.append('api_option', 'paste');
            params.append('api_paste_code', content);
            params.append('api_paste_name', title);
            params.append('api_paste_format', format);
            params.append('api_paste_private', privacy);
            params.append('api_paste_expire_date', 'N'); // Never expire

            const response = await fetch('https://pastebin.com/api/api_post.php', {
                method: 'POST',
                body: params,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const text = await response.text();

            // Pastebin returns the URL directly on success, or "Bad API request, ..." on error
            if (!text.startsWith('https://pastebin.com/')) {
                throw new Error(`Pastebin API error: ${text}`);
            }

            console.log(`[Pastebin] Upload successful: ${text}`);

            // Extract paste ID and return custom session ID format
            const pasteId = text.replace('https://pastebin.com/', '').trim();
            const sessionId = `EF-PRIME-MD_${pasteId}`;

            console.log(`[Pastebin] Session ID: ${sessionId}`);
            return sessionId;

        } catch (err) {
            console.error(`[Pastebin] Key ${i + 1} failed:`, err.message);
            lastError = err;

            if (i < API_KEYS.length - 1) {
                console.log('[Pastebin] Trying next key...');
            }
        }
    }

    throw new Error(`All Pastebin API keys failed. Last error: ${lastError?.message}`);
}

module.exports = uploadToPastebin;
