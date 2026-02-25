const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const uploadToPastebin = require('./Paste');

let router = express.Router();

const MESSAGE = process.env.MESSAGE || `
🚀 *_EF-PRIME-MD-ULTRA Session Activated_* 💻

╭─❒ *🎉 SESSION INFO* ❒
├⬡ 🆔 Session ID successfully generated!
├⬡ 🤖 Bot: EF-PRIME-MD-ULTRA V2
├⬡ 😎 Welcome to the next-gen experience!
╰────────────❒

> ✅ Thank you for choosing *EF-PRIME-MD V2*!
> 🔒 Your session is now active and secured`;

const AUTH_DIR = path.join(__dirname, 'auth_info_baileys');

// ✅ Pretty logger — shows real readable logs in terminal
const logger = pino({
    level: 'debug',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '[Baileys] {msg}',
        }
    }
});

// Fallback to plain pino if pino-pretty not installed
const safeLogger = (() => {
    try {
        return logger;
    } catch {
        return pino({ level: 'info' });
    }
})();

function log(emoji, label, msg, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    if (data) {
        console.log(`\x1b[36m[${timestamp}]\x1b[0m ${emoji} \x1b[1m${label}\x1b[0m: ${msg}`, data);
    } else {
        console.log(`\x1b[36m[${timestamp}]\x1b[0m ${emoji} \x1b[1m${label}\x1b[0m: ${msg}`);
    }
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required. Use ?number=2637XXXXXXXX' });
    }

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 7) {
        return res.status(400).json({ error: 'Invalid phone number.' });
    }

    log('📞', 'PAIR REQUEST', `Pairing request received for number: +${num}`);

    // Fresh auth dir for every pairing attempt
    try {
        if (fs.existsSync(AUTH_DIR)) {
            log('🗑️ ', 'AUTH DIR', 'Clearing old auth files...');
            fs.emptyDirSync(AUTH_DIR);
        } else {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        log('✅', 'AUTH DIR', 'Auth directory is clean and ready.');
    } catch (e) {
        log('❌', 'AUTH DIR', `Error cleaning auth dir: ${e.message}`);
    }

    try {
        log('📦', 'BAILEYS', 'Loading Baileys module (ESM dynamic import)...');

        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            Browsers,
            DisconnectReason
        } = await import('@whiskeysockets/baileys');

        log('✅', 'BAILEYS', 'Module loaded successfully.');

        log('🌐', 'BAILEYS', 'Fetching latest WhatsApp version...');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        log('✅', 'BAILEYS', `Using WhatsApp v${version.join('.')} — isLatest: ${isLatest}`);

        log('🔐', 'AUTH STATE', 'Loading multi-file auth state...');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        log('✅', 'AUTH STATE', `Auth state loaded. Registered: ${state.creds.registered}`);

        log('🔌', 'SOCKET', 'Creating WhatsApp socket...');
        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })),
            },
            logger: pino({ level: 'fatal' }), // keep baileys internal logs silent, we handle our own
            printQRInTerminal: false,
            keepAliveIntervalMs: 10_000,
            connectTimeoutMs: 60_000,
            retryRequestDelayMs: 250,
            maxMsgRetryCount: 5,
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false,
            fireInitQueries: true,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
        });

        log('✅', 'SOCKET', 'Socket created. Waiting for connection events...');

        sock.ev.on('creds.update', () => {
            log('💾', 'CREDS', 'Credentials updated — saving to disk...');
            saveCreds();
            log('✅', 'CREDS', 'Credentials saved.');
        });

        let pairingCodeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = update;

            if (connection) {
                log('🔄', 'CONNECTION', `State changed → ${connection.toUpperCase()}`);
            }

            if (isNewLogin) {
                log('🆕', 'CONNECTION', 'New login detected!');
            }

            if (receivedPendingNotifications) {
                log('📬', 'CONNECTION', 'Received pending notifications from WhatsApp.');
            }

            if (qr) {
                log('📸', 'QR', 'QR code generated (not used — using pairing code instead).');
            }

            // ✅ Request pairing code when connecting or QR is available
            if (!pairingCodeSent && !sock.authState.creds.registered) {
                if (connection === 'connecting' || !!qr) {
                    pairingCodeSent = true;
                    log('⏳', 'PAIRING', `Requesting pairing code for +${num}...`);
                    try {
                        await delay(1500);
                        const code = await sock.requestPairingCode(num);
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        log('✅', 'PAIRING', `Pairing code generated: \x1b[33m${formatted}\x1b[0m`);
                        if (!res.headersSent) {
                            res.json({ code: formatted });
                        }
                    } catch (err) {
                        log('❌', 'PAIRING', `Failed to generate pairing code: ${err.message}`);
                        pairingCodeSent = false;
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                        }
                    }
                }
            }

            // ✅ Connected — upload creds
            if (connection === 'open') {
                log('🎉', 'CONNECTION', 'WhatsApp connection is OPEN! Session established.');
                log('👤', 'USER', `Logged in as: ${sock.user?.id} (${sock.user?.name || 'Unknown'})`);

                try {
                    log('⏳', 'CREDS UPLOAD', 'Waiting 3s for creds to be fully written to disk...');
                    await delay(3000);

                    const credsFile = path.join(AUTH_DIR, 'creds.json');

                    log('🔍', 'CREDS UPLOAD', 'Checking for creds.json...');
                    for (let i = 0; i < 8; i++) {
                        if (fs.existsSync(credsFile)) {
                            log('✅', 'CREDS UPLOAD', `creds.json found on attempt ${i + 1}.`);
                            break;
                        }
                        log('⏳', 'CREDS UPLOAD', `creds.json not ready yet... (${i + 1}/8)`);
                        await delay(1000);
                    }

                    if (!fs.existsSync(credsFile)) {
                        throw new Error('creds.json was never written to disk after 8 retries.');
                    }

                    const fileSize = fs.statSync(credsFile).size;
                    log('📄', 'CREDS UPLOAD', `creds.json is ${fileSize} bytes. Sending presence update...`);

                    await sock.sendPresenceUpdate('available');
                    log('✅', 'PRESENCE', 'Presence update sent — connection marked as active.');

                    log('🚀', 'PASTEBIN', 'Uploading creds.json to Pastebin...');
                    const sessionId = await uploadToPastebin(credsFile, 'creds.json', 'json', '1');
                    log('✅', 'PASTEBIN', `Upload successful! Session ID: \x1b[32m${sessionId}\x1b[0m`);

                    const userId = sock.user.id;
                    log('📤', 'WHATSAPP', `Sending session ID to user: ${userId}`);
                    const sent = await sock.sendMessage(userId, { text: sessionId });
                    await sock.sendMessage(userId, { text: MESSAGE }, { quoted: sent });

                    log('🎊', 'DONE', 'Session ID and welcome message sent to WhatsApp successfully!');
                    await delay(1000);

                } catch (e) {
                    log('❌', 'UPLOAD ERROR', e.message);
                }

                log('🧹', 'CLEANUP', 'Clearing auth directory...');
                try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                log('✅', 'CLEANUP', 'Auth directory cleared.');
            }

            // ✅ Disconnection handling with detailed reason
            if (connection === 'close') {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const errorMsg = lastDisconnect?.error?.message || 'Unknown';

                log('🔴', 'DISCONNECTED', `Connection closed. Status code: ${statusCode} — ${errorMsg}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    log('🚪', 'DISCONNECT', 'Reason: Logged out from WhatsApp. Clearing auth...');
                    try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}

                } else if (statusCode === DisconnectReason.restartRequired) {
                    log('🔁', 'DISCONNECT', 'Reason: Restart required (normal after pairing).');

                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    log('🔀', 'DISCONNECT', 'Reason: Connection replaced by another session.');

                } else if (statusCode === DisconnectReason.timedOut) {
                    log('⏰', 'DISCONNECT', 'Reason: Connection timed out — WhatsApp did not respond.');

                } else if (statusCode === DisconnectReason.connectionClosed) {
                    log('🔌', 'DISCONNECT', 'Reason: WhatsApp closed the connection.');

                } else if (statusCode === DisconnectReason.connectionLost) {
                    log('📡', 'DISCONNECT', 'Reason: Connection to WhatsApp servers was lost.');

                } else {
                    log('⚠️ ', 'DISCONNECT', `Unknown reason (${statusCode}). Restarting pm2 in 5s...`);
                    await delay(5000);
                    exec('pm2 restart qasim');
                }
            }
        });

    } catch (err) {
        log('💥', 'FATAL ERROR', err.message);
        console.error(err);
        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error. Try again.' });
        }
    }
});

module.exports = router;
