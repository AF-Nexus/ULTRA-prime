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

// ✅ Pure console.log colored logger — zero extra dependencies
const C = {
    reset:  '\x1b[0m',
    bright: '\x1b[1m',
    cyan:   '\x1b[36m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m',
    blue:   '\x1b[34m',
    gray:   '\x1b[90m',
};

function log(emoji, label, msg) {
    const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const tag = `${C.cyan}[${time}]${C.reset}`;
    const lbl = `${C.bright}${C.blue}${label}${C.reset}`;
    console.log(`${tag} ${emoji}  ${lbl}: ${msg}`);
}

function logOk(emoji, label, msg)    { const time = new Date().toLocaleTimeString('en-GB', { hour12: false }); console.log(`${C.cyan}[${time}]${C.reset} ${emoji}  ${C.bright}${C.green}${label}${C.reset}: ${msg}`); }
function logWarn(emoji, label, msg)  { const time = new Date().toLocaleTimeString('en-GB', { hour12: false }); console.log(`${C.cyan}[${time}]${C.reset} ${emoji}  ${C.bright}${C.yellow}${label}${C.reset}: ${msg}`); }
function logErr(emoji, label, msg)   { const time = new Date().toLocaleTimeString('en-GB', { hour12: false }); console.log(`${C.cyan}[${time}]${C.reset} ${emoji}  ${C.bright}${C.red}${label}${C.reset}: ${msg}`); }

// Silent pino logger — only used internally by baileys, we handle our own logs
const silentLogger = pino({ level: 'silent' });

router.get('/', async (req, res) => {
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required. Use ?number=2637XXXXXXXX' });
    }

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 7) {
        return res.status(400).json({ error: 'Invalid phone number.' });
    }

    log('📞', 'PAIR REQUEST', `Incoming pairing request for +${num}`);

    // Clean auth dir
    try {
        if (fs.existsSync(AUTH_DIR)) {
            log('🗑️ ', 'AUTH DIR', 'Clearing old session files...');
            fs.emptyDirSync(AUTH_DIR);
        } else {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        logOk('✅', 'AUTH DIR', 'Auth directory ready.');
    } catch (e) {
        logErr('❌', 'AUTH DIR', `Failed to clean auth dir: ${e.message}`);
    }

    try {
        log('📦', 'BAILEYS', 'Loading @whiskeysockets/baileys (ESM dynamic import)...');

        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            Browsers,
            DisconnectReason
        } = await import('@whiskeysockets/baileys');

        logOk('✅', 'BAILEYS', 'Module loaded.');

        log('🌐', 'VERSION', 'Fetching latest WhatsApp Web version...');
        const { version, isLatest } = await fetchLatestBaileysVersion();
        logOk('✅', 'VERSION', `WhatsApp v${version.join('.')} — isLatest: ${isLatest}`);

        log('🔐', 'AUTH STATE', 'Loading auth state from disk...');
        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        logOk('✅', 'AUTH STATE', `Auth loaded. Already registered: ${state.creds.registered}`);

        log('🔌', 'SOCKET', 'Creating WhatsApp socket connection...');

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
            },
            logger: silentLogger,
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

        logOk('✅', 'SOCKET', 'Socket created. Listening for connection events...');

        sock.ev.on('creds.update', () => {
            log('💾', 'CREDS', 'Credentials updated — saving...');
            saveCreds();
            logOk('✅', 'CREDS', 'Credentials saved to disk.');
        });

        let pairingCodeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr, receivedPendingNotifications, isNewLogin } = update;

            if (connection) {
                log('🔄', 'CONNECTION', `State → ${C.bright}${connection.toUpperCase()}${C.reset}`);
            }

            if (isNewLogin)                    logOk('🆕', 'LOGIN', 'New login detected!');
            if (receivedPendingNotifications)  log('📬', 'NOTIFICATIONS', 'Received pending WhatsApp notifications.');
            if (qr)                            logWarn('📸', 'QR', 'QR generated (ignored — using pairing code).');

            // ✅ Request pairing code on connecting or QR
            if (!pairingCodeSent && !sock.authState.creds.registered) {
                if (connection === 'connecting' || !!qr) {
                    pairingCodeSent = true;
                    log('⏳', 'PAIRING', `Requesting pairing code for +${num}...`);
                    try {
                        await delay(1500);
                        const code = await sock.requestPairingCode(num);
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        logOk('🎯', 'PAIRING', `Code ready: ${C.yellow}${C.bright}${formatted}${C.reset}`);
                        if (!res.headersSent) {
                            res.json({ code: formatted });
                        }
                    } catch (err) {
                        logErr('❌', 'PAIRING', `Failed: ${err.message}`);
                        pairingCodeSent = false;
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                        }
                    }
                }
            }

            // ✅ Connection open — upload creds
            if (connection === 'open') {
                logOk('🎉', 'CONNECTED', 'WhatsApp connection OPEN! Session established.');
                log('👤', 'USER', `Logged in as: ${C.green}${sock.user?.id}${C.reset} — Name: ${sock.user?.name || 'Unknown'}`);

                try {
                    log('⏳', 'UPLOAD', 'Waiting 3s for creds to finish writing to disk...');
                    await delay(3000);

                    const credsFile = path.join(AUTH_DIR, 'creds.json');

                    let found = false;
                    for (let i = 0; i < 8; i++) {
                        if (fs.existsSync(credsFile)) {
                            found = true;
                            logOk('✅', 'UPLOAD', `creds.json found (attempt ${i + 1}) — size: ${fs.statSync(credsFile).size} bytes`);
                            break;
                        }
                        logWarn('⏳', 'UPLOAD', `creds.json not ready yet... (${i + 1}/8)`);
                        await delay(1000);
                    }

                    if (!found) throw new Error('creds.json was never written after 8 retries.');

                    log('📡', 'PRESENCE', 'Sending presence update to keep connection alive...');
                    await sock.sendPresenceUpdate('available');
                    logOk('✅', 'PRESENCE', 'Presence sent.');

                    log('🚀', 'PASTEBIN', 'Uploading creds.json to Pastebin...');
                    const sessionId = await uploadToPastebin(credsFile, 'creds.json', 'json', '1');
                    logOk('✅', 'PASTEBIN', `Upload done! Session ID: ${C.green}${C.bright}${sessionId}${C.reset}`);

                    const userId = sock.user.id;
                    log('📤', 'WHATSAPP', `Sending session ID message to ${userId}...`);
                    const sent = await sock.sendMessage(userId, { text: sessionId });
                    await sock.sendMessage(userId, { text: MESSAGE }, { quoted: sent });
                    logOk('🎊', 'DONE', 'Session ID and welcome message delivered to WhatsApp!');

                    await delay(1000);

                } catch (e) {
                    logErr('❌', 'UPLOAD ERROR', e.message);
                }

                log('🧹', 'CLEANUP', 'Clearing auth directory...');
                try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                logOk('✅', 'CLEANUP', 'Auth directory cleared.');
            }

            // ✅ Connection closed
            if (connection === 'close') {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                const errMsg = lastDisconnect?.error?.message || 'Unknown error';
                logErr('🔴', 'DISCONNECTED', `Connection closed — Code: ${statusCode} — ${errMsg}`);

                if (statusCode === DisconnectReason.loggedOut) {
                    logWarn('🚪', 'DISCONNECT', 'Reason: Logged out. Clearing auth...');
                    try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                } else if (statusCode === DisconnectReason.restartRequired) {
                    logWarn('🔁', 'DISCONNECT', 'Reason: Restart required (normal after pairing).');
                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    logWarn('🔀', 'DISCONNECT', 'Reason: Replaced by another session.');
                } else if (statusCode === DisconnectReason.timedOut) {
                    logWarn('⏰', 'DISCONNECT', 'Reason: Timed out — no response from WhatsApp.');
                } else if (statusCode === DisconnectReason.connectionClosed) {
                    logWarn('🔌', 'DISCONNECT', 'Reason: WhatsApp closed the connection.');
                } else if (statusCode === DisconnectReason.connectionLost) {
                    logWarn('📡', 'DISCONNECT', 'Reason: Connection to WA servers lost.');
                } else {
                    logWarn('⚠️ ', 'DISCONNECT', `Unknown reason (${statusCode}). Restarting pm2 in 5s...`);
                    await delay(5000);
                    exec('pm2 restart qasim');
                }
            }
        });

    } catch (err) {
        logErr('💥', 'FATAL', err.message);
        console.error(err);
        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error. Try again.' });
        }
    }
});

module.exports = router;
