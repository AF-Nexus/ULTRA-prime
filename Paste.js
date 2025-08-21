const fs = require('fs');
const path = require('path');

// Multiple API keys for fallback
const API_KEYS = [
    'KpoS0JysNXgUSgCWH2hr__2OG7aJ30S_',
    'furii3L3ijdpwYB-vZ_jej7CxvNjFESk',
    'PS0uqmRdEQ3mSqNWD28lccEmQMz-eu7'
];

// Rate limiting and ban system
class RateLimiter {
    constructor() {
        this.requestLog = new Map(); // userId -> array of timestamps
        this.bannedUsers = new Map(); // userId -> ban expiry timestamp
        this.MAX_REQUESTS = 3;
        this.TIME_WINDOW = 8 * 60 * 60 * 1000; // 8 hours in milliseconds
        this.BAN_DURATION = 8 * 60 * 60 * 1000; // 8 hours ban duration
    }

    /**
     * Check if a user is currently banned
     * @param {string} userId - Unique identifier for the user
     * @returns {boolean} - True if user is banned
     */
    isBanned(userId) {
        const banExpiry = this.bannedUsers.get(userId);
        if (!banExpiry) return false;

        const now = Date.now();
        if (now >= banExpiry) {
            // Ban has expired, remove from banned list
            this.bannedUsers.delete(userId);
            return false;
        }
        return true;
    }

    /**
     * Get remaining ban time in milliseconds
     * @param {string} userId - Unique identifier for the user
     * @returns {number} - Remaining ban time in milliseconds, 0 if not banned
     */
    getBanTimeRemaining(userId) {
        const banExpiry = this.bannedUsers.get(userId);
        if (!banExpiry) return 0;

        const now = Date.now();
        return Math.max(0, banExpiry - now);
    }

    /**
     * Check if user can make a request and update their request log
     * @param {string} userId - Unique identifier for the user
     * @returns {object} - { allowed: boolean, message: string, banTimeRemaining?: number }
     */
    checkRateLimit(userId) {
        // Check if user is banned
        if (this.isBanned(userId)) {
            const remainingTime = this.getBanTimeRemaining(userId);
            const hours = Math.ceil(remainingTime / (60 * 60 * 1000));
            return {
                allowed: false,
                message: `You are temporarily banned. Ban expires in approximately ${hours} hour(s).contact frankdev if u think there is an error`,
                banTimeRemaining: remainingTime
            };
        }

        const now = Date.now();
        const userRequests = this.requestLog.get(userId) || [];

        // Remove old requests outside the time window
        const recentRequests = userRequests.filter(timestamp => 
            now - timestamp < this.TIME_WINDOW
        );

        // Check if user has exceeded the limit
        if (recentRequests.length >= this.MAX_REQUESTS) {
            // Ban the user
            const banExpiry = now + this.BAN_DURATION;
            this.bannedUsers.set(userId, banExpiry);
            
            // Clear their request log since they're now banned
            this.requestLog.delete(userId);

            const hours = Math.ceil(this.BAN_DURATION / (60 * 60 * 1000));
            return {
                allowed: false,
                message: `Rate limit exceeded! You have been banned for ${hours} hours due to making ${this.MAX_REQUESTS} requests within 8 hours.`,
                banTimeRemaining: this.BAN_DURATION
            };
        }

        // Add current request to log
        recentRequests.push(now);
        this.requestLog.set(userId, recentRequests);

        const remainingRequests = this.MAX_REQUESTS - recentRequests.length;
        return {
            allowed: true,
            message: `Request allowed. ${remainingRequests} request(s) remaining in the next 8 hours.`,
            remainingRequests: remainingRequests
        };
    }

    /**
     * Manually unban a user (admin function)
     * @param {string} userId - Unique identifier for the user
     */
    unbanUser(userId) {
        this.bannedUsers.delete(userId);
        this.requestLog.delete(userId);
    }

    /**
     * Get user's current request count in the time window
     * @param {string} userId - Unique identifier for the user
     * @returns {number} - Number of requests made in current time window
     */
    getUserRequestCount(userId) {
        if (this.isBanned(userId)) return this.MAX_REQUESTS;
        
        const now = Date.now();
        const userRequests = this.requestLog.get(userId) || [];
        return userRequests.filter(timestamp => 
            now - timestamp < this.TIME_WINDOW
        ).length;
    }

    /**
     * Clean up expired bans and old request logs (maintenance function)
     */
    cleanup() {
        const now = Date.now();
        
        // Remove expired bans
        for (const [userId, banExpiry] of this.bannedUsers.entries()) {
            if (now >= banExpiry) {
                this.bannedUsers.delete(userId);
            }
        }

        // Clean old request logs
        for (const [userId, requests] of this.requestLog.entries()) {
            const recentRequests = requests.filter(timestamp => 
                now - timestamp < this.TIME_WINDOW
            );
            if (recentRequests.length === 0) {
                this.requestLog.delete(userId);
            } else {
                this.requestLog.set(userId, recentRequests);
            }
        }
    }
}

// Global rate limiter instance
const rateLimiter = new RateLimiter();

// Run cleanup every hour
setInterval(() => {
    rateLimiter.cleanup();
}, 60 * 60 * 1000);

/**
 * Uploads content to Pastebin with rate limiting and ban system.
 * @param {string | Buffer} input - The content to upload, can be text, file path, or base64 data.
 * @param {string} userId - Unique identifier for the user making the request.
 * @param {string} [title] - Optional title for the paste.
 * @param {string} [format] - Optional syntax highlighting format (e.g., 'text', 'python', 'javascript').
 * @param {string} [privacy] - Optional privacy setting (0 = public, 1 = unlisted, 2 = private).
 * @returns {Promise<object>} - Object containing success status, custom URL or error message, and rate limit info.
 */
async function uploadToPastebin(input, userId, title = 'Untitled', format = 'json', privacy = '1') {
    // Check rate limit and ban status
    const rateLimitCheck = rateLimiter.checkRateLimit(userId);
    
    if (!rateLimitCheck.allowed) {
        return {
            success: false,
            error: rateLimitCheck.message,
            rateLimitInfo: {
                banned: true,
                banTimeRemaining: rateLimitCheck.banTimeRemaining,
                requestsRemaining: 0
            }
        };
    }

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

            // Return success response with rate limit info
            return {
                success: true,
                customUrl: customUrl,
                originalUrl: pasteUrl,
                rateLimitInfo: {
                    banned: false,
                    requestsRemaining: rateLimitCheck.remainingRequests,
                    message: rateLimitCheck.message
                }
            };

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

    // If all API keys failed, return error response
    return {
        success: false,
        error: `Upload failed after trying all API keys. Last error: ${lastError.message}`,
        rateLimitInfo: {
            banned: false,
            requestsRemaining: rateLimitCheck.remainingRequests,
            message: rateLimitCheck.message
        }
    };
}

/**
 * Check user's current rate limit status
 * @param {string} userId - Unique identifier for the user
 * @returns {object} - Rate limit status information
 */
function checkUserStatus(userId) {
    const isBanned = rateLimiter.isBanned(userId);
    const requestCount = rateLimiter.getUserRequestCount(userId);
    const banTimeRemaining = rateLimiter.getBanTimeRemaining(userId);
    
    return {
        userId: userId,
        banned: isBanned,
        requestCount: requestCount,
        requestsRemaining: Math.max(0, rateLimiter.MAX_REQUESTS - requestCount),
        banTimeRemaining: banTimeRemaining,
        banTimeRemainingHours: banTimeRemaining ? Math.ceil(banTimeRemaining / (60 * 60 * 1000)) : 0
    };
}

/**
 * Admin function to unban a user
 * @param {string} userId - Unique identifier for the user to unban
 */
function unbanUser(userId) {
    rateLimiter.unbanUser(userId);
    console.log(`User ${userId} has been unbanned.`);
}

module.exports = {
    uploadToPastebin,
    checkUserStatus,
    unbanUser,
    rateLimiter // Export for testing purposes
};
