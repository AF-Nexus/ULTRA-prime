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
 * Uploads content to Pastebin using direct HTTP POST (no ESM deps).
 * @param {string|Buffer} input - File path, text, Buffer, or base64 data URL.
 * @param {string} title - Paste title.
 * @param {string} format - Syntax format e.g. 'json', 'text'.
 * @param {string} privacy - '0' public, '1' unlisted, '2' private.
 * @returns {Promise<string>} - Custom session ID string e.g. EF-PRIME-MD_XXXXXXXX
 */
async function uploadToPastebin(input, title = 'creds.json', format = 'json', privacy = '1') {
    let content = '';

    // Resolve content from whatever input type is given
    if (Buffer.isBuffer(input)) {
        content = input.toString('utf8');
    } else if (typeof input === 'string') {
        if (input.startsWith('data:')) {
            // base64 data URL
            const base64Part = input.split(',')[1];
            content = Buffer.from(base64Part, 'base64').toString('utf8');
        } else if (fs.existsSync(input)) {
            // file path
            content = fs.readFileSync(input, 'utf8');
        } else {
            // plain text
            content = input;
        }
    } else {
        throw new Error('Unsupported input type. Provide a file path, text, or Buffer.');
    }

    if (!content || content.trim() === '') {
        throw new Error('Content is empty — nothing to upload.');
    }

    let lastError = null;

    for (let i = 0; i < API_KEYS.length; i++) {
        const apiKey = API_KEYS[i];
        console.log(`[Pastebin] Trying API key ${i + 1}/${API_KEYS.length}...`);

        try {
            const body = new URLSearchParams();
            body.append('api_dev_key', apiKey);
            body.append('api_option', 'paste');
            body.append('api_paste_code', content);
            body.append('api_paste_name', title);
            body.append('api_paste_format', format);
            body.append('api_paste_private', privacy);
            body.append('api_paste_expire_date', 'N'); // Never expire

            const response = await fetch('https://pastebin.com/api/api_post.php', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const text = await response.text();

            // Pastebin returns the full URL on success, or an error string starting with "Bad API request"
            if (!text.startsWith('https://pastebin.com/')) {
                throw new Error(`Pastebin rejected: ${text}`);
            }

            const pasteId = text.replace('https://pastebin.com/', '').trim();
            const sessionId = `EF-PRIME-MD_${pasteId}`;

            console.log(`[Pastebin] ✅ Uploaded! Session ID: ${sessionId}`);
            return sessionId;

        } catch (err) {
            console.error(`[Pastebin] ❌ Key ${i + 1} failed: ${err.message}`);
            lastError = err;
        }
    }

    throw new Error(`All Pastebin API keys failed. Last error: ${lastError?.message}`);
}

module.exports = uploadToPastebin;
