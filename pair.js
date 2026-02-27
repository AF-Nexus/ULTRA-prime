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

const C = {
    reset:  '\x1b[0m',
    bright: '\x1b[1m',
    cyan:   '\x1b[36m',
    green:  '\x1b[32m',
    yellow: '\x1b[33m',
    red:    '\x1b[31m',
    blue:   '\x1b[34m',
};

function ts() { return new Date().toLocaleTimeString('en-GB', { hour12: false }); }
function log(e, l, m)     { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.blue}${l}${C.reset}: ${m}`); }
function logOk(e, l, m)   { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.green}${l}${C.reset}: ${m}`); }
function logWarn(e, l, m) { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.yellow}${l}${C.reset}: ${m}`); }
function logErr(e, l, m)  { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.red}${l}${C.reset}: ${m}`); }

const silentLogger = pino({ level: 'silent' });

// Ensure auth dir is clean on startup
if (fs.existsSync(AUTH_DIR)) {
    fs.emptyDirSync(AUTH_DIR);
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
        logErr('❌', 'AUTH DIR', `Failed: ${e.message}`);
    }

    try {
        log('📦', 'BAILEYS', 'Loading @whiskeysockets/baileys...');

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

        let sessionUploaded = false;

        // ─── PHASE 1: Pairing — get the code and send it back ───────────────
        async function startPairing() {
            log('🔐', 'AUTH STATE', 'Loading auth state...');
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

            log('🔌', 'SOCKET', 'Creating socket for pairing...');
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
                browser: Browsers.macOS('Safari'),
                markOnlineOnConnect: false,
                fireInitQueries: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
            });

            sock.ev.on('creds.update', saveCreds);

            log('⏳', 'PAIRING', `Waiting for socket to be ready...`);
            await delay(2000);

            try {
                log('⏳', 'PAIRING', `Requesting pairing code for +${num}...`);
                const code = await sock.requestPairingCode(num);
                const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                logOk('🎯', 'PAIRING', `Code ready: ${C.yellow}${C.bright}${formatted}${C.reset}`);
                if (!res.headersSent) {
                    res.json({ code: formatted });
                }
            } catch (err) {
                logErr('❌', 'PAIRING', `Failed to get pairing code: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                }
                return;
            }

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;

                if (connection)                   log('🔄', 'CONNECTION', `State → ${C.bright}${connection.toUpperCase()}${C.reset}`);
                if (isNewLogin)                   logOk('🆕', 'LOGIN', 'New login detected!');
                if (receivedPendingNotifications) log('📬', 'NOTIFICATIONS', 'Received pending notifications.');

                if (connection === 'open') {
                    logOk('🎉', 'CONNECTED', 'Pairing socket connected!');
                }

                if (connection === 'close') {
                    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    const errMsg = lastDisconnect?.error?.message || 'Unknown';
                    logErr('🔴', 'DISCONNECTED', `Code: ${statusCode} — ${errMsg}`);

                    if (statusCode === DisconnectReason.restartRequired) {
                        logWarn('🔁', 'RECONNECT', 'Restart required — launching session phase...');
                        await delay(2000);
                        startSession().catch(err => logErr('❌', 'SESSION ERROR', err.message));
                    } else {
                        logWarn('⚠️ ', 'DISCONNECT', `Unexpected close (${statusCode}). Restarting pm2...`);
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });
        }

        // ─── PHASE 2: Session — reconnect with saved creds and upload ────────
        async function startSession() {
            if (sessionUploaded) return;

            log('🔐', 'SESSION', 'Loading saved auth state for session...');
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
            logOk('✅', 'SESSION', `Auth loaded. Registered: ${C.green}${state.creds.registered}${C.reset}`);

            log('🔌', 'SESSION', 'Creating session socket...');
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
                browser: Browsers.macOS('Safari'),
                markOnlineOnConnect: false,
                fireInitQueries: true,
                generateHighQualityLinkPreview: false,
                syncFullHistory: false,
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;

                if (connection)                   log('🔄', 'SESSION', `State → ${C.bright}${connection.toUpperCase()}${C.reset}`);
                if (isNewLogin)                   logOk('🆕', 'SESSION', 'New login confirmed!');
                if (receivedPendingNotifications) log('📬', 'SESSION', 'Received pending notifications.');

                if (connection === 'open' && !sessionUploaded) {
                    sessionUploaded = true;
                    logOk('🎉', 'SESSION', 'Session socket OPEN!');
                    log('👤', 'USER', `Logged in as: ${C.green}${sock.user?.id}${C.reset} — Name: ${sock.user?.name || 'Unknown'}`);

                    try {
                        log('⏳', 'UPLOAD', 'Waiting 10s for creds to finish writing...');
                        await delay(10000);

                        const credsFile = path.join(AUTH_DIR, 'creds.json');
                        let found = false;

                        for (let i = 0; i < 8; i++) {
                            if (fs.existsSync(credsFile)) {
                                found = true;
                                logOk('✅', 'UPLOAD', `creds.json found — ${fs.statSync(credsFile).size} bytes`);
                                break;
                            }
                            logWarn('⏳', 'UPLOAD', `Waiting for creds.json... (${i + 1}/8)`);
                            await delay(1000);
                        }

                        if (!found) throw new Error('creds.json never written after 8 retries.');

                        log('📡', 'PRESENCE', 'Sending presence update...');
                        await sock.sendPresenceUpdate('available');
                        logOk('✅', 'PRESENCE', 'Presence sent.');

                        log('🚀', 'PASTEBIN', 'Uploading creds.json to Pastebin...');
                        const sessionId = await uploadToPastebin(credsFile, 'creds.json', 'json', '1');
                        logOk('✅', 'PASTEBIN', `Done! Session ID: ${C.green}${C.bright}${sessionId}${C.reset}`);

                        const userId = sock.user.id;
                        log('📤', 'WHATSAPP', `Sending session ID to ${userId}...`);
                        const sent = await sock.sendMessage(userId, { text: sessionId });
                        await sock.sendMessage(userId, { text: MESSAGE }, { quoted: sent });
                        logOk('🎊', 'DONE', 'Session ID and welcome message delivered!');

                        await delay(1000);

                    } catch (e) {
                        logErr('❌', 'UPLOAD ERROR', e.message);
                    }

                    log('🧹', 'CLEANUP', 'Clearing auth directory...');
                    try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                    logOk('✅', 'CLEANUP', 'Done.');
                }

                if (connection === 'close') {
                    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    const errMsg = lastDisconnect?.error?.message || 'Unknown';
                    logErr('🔴', 'SESSION CLOSED', `Code: ${statusCode} — ${errMsg}`);

                    if (statusCode === DisconnectReason.restartRequired) {
                        logWarn('🔁', 'SESSION', 'Restart required again — retrying session...');
                        await delay(2000);
                        startSession().catch(err => logErr('❌', 'SESSION RETRY ERROR', err.message));
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        logWarn('🚪', 'SESSION', 'Logged out. Clearing auth...');
                        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                    } else {
                        logWarn('⚠️ ', 'SESSION', `Unexpected close (${statusCode}). Restarting pm2...`);
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });
        }

        // Kick off pairing phase
        await startPairing();

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
