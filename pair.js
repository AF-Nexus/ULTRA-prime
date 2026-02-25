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
};

function ts() { return new Date().toLocaleTimeString('en-GB', { hour12: false }); }
function log(e, l, m)     { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.blue}${l}${C.reset}: ${m}`); }
function logOk(e, l, m)   { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.green}${l}${C.reset}: ${m}`); }
function logWarn(e, l, m) { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.yellow}${l}${C.reset}: ${m}`); }
function logErr(e, l, m)  { console.log(`${C.cyan}[${ts()}]${C.reset} ${e}  ${C.bright}${C.red}${l}${C.reset}: ${m}`); }

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

        // ─── This function creates a socket and handles the full lifecycle ───
        // It is called once for pairing, then again after restartRequired
        // to establish the real authenticated session and upload creds.
        async function createSocket(isPairingPhase) {
            log('🔐', 'AUTH STATE', 'Loading auth state...');
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
            logOk('✅', 'AUTH STATE', `Auth loaded. Registered: ${state.creds.registered}`);

            log('🔌', 'SOCKET', `Creating socket — phase: ${isPairingPhase ? 'PAIRING' : 'SESSION'}...`);

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

            logOk('✅', 'SOCKET', 'Socket created. Listening for events...');

            sock.ev.on('creds.update', () => {
                log('💾', 'CREDS', 'Credentials updated — saving...');
                saveCreds();
                logOk('✅', 'CREDS', 'Credentials saved to disk.');
            });

            let pairingCodeSent = false;

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;

                if (connection) log('🔄', 'CONNECTION', `State → ${C.bright}${connection.toUpperCase()}${C.reset}`);
                if (isNewLogin)                   logOk('🆕', 'LOGIN', 'New login detected!');
                if (receivedPendingNotifications) log('📬', 'NOTIFICATIONS', 'Received pending notifications.');
                if (qr)                           logWarn('📸', 'QR', 'QR generated (ignored — using pairing code).');

                // ── PHASE 1: Send pairing code (only during pairing phase) ──
                if (isPairingPhase && !pairingCodeSent && !sock.authState.creds.registered) {
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

                // ── PHASE 2: Upload creds after real session is open ──
                if (connection === 'open') {
                    logOk('🎉', 'CONNECTED', 'WhatsApp connection OPEN! Session established.');
                    log('👤', 'USER', `Logged in as: ${C.green}${sock.user?.id}${C.reset} — Name: ${sock.user?.name || 'Unknown'}`);

                    // Only upload on the session phase (after restart), not during pairing phase
                    // But if creds are registered it means this is already the real session
                    if (!isPairingPhase || sock.authState.creds.registered) {
                        try {
                            log('⏳', 'UPLOAD', 'Waiting 3s for creds to finish writing...');
                            await delay(3000);

                            const credsFile = path.join(AUTH_DIR, 'creds.json');
                            let found = false;

                            for (let i = 0; i < 8; i++) {
                                if (fs.existsSync(credsFile)) {
                                    found = true;
                                    logOk('✅', 'UPLOAD', `creds.json found (attempt ${i + 1}) — ${fs.statSync(credsFile).size} bytes`);
                                    break;
                                }
                                logWarn('⏳', 'UPLOAD', `creds.json not ready... (${i + 1}/8)`);
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
                }

                // ── Handle disconnections ──
                if (connection === 'close') {
                    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    const errMsg = lastDisconnect?.error?.message || 'Unknown';
                    logErr('🔴', 'DISCONNECTED', `Code: ${statusCode} — ${errMsg}`);

                    if (statusCode === DisconnectReason.restartRequired) {
                        // ✅ This is the key fix — after pairing WA sends 515 restartRequired
                        // We must create a NEW socket with the saved creds to complete login
                        logWarn('🔁', 'RECONNECT', 'Restart required after pairing — reconnecting to establish session...');
                        await delay(2000);
                        createSocket(false).catch(err => logErr('❌', 'RECONNECT ERROR', err.message));

                    } else if (statusCode === DisconnectReason.loggedOut) {
                        logWarn('🚪', 'DISCONNECT', 'Logged out. Clearing auth...');
                        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}

                    } else if (statusCode === DisconnectReason.connectionReplaced) {
                        logWarn('🔀', 'DISCONNECT', 'Replaced by another session.');

                    } else if (statusCode === DisconnectReason.timedOut) {
                        logWarn('⏰', 'DISCONNECT', 'Timed out.');

                    } else if (statusCode === DisconnectReason.connectionClosed) {
                        logWarn('🔌', 'DISCONNECT', 'WA closed the connection.');

                    } else if (statusCode === DisconnectReason.connectionLost) {
                        logWarn('📡', 'DISCONNECT', 'Lost connection to WA servers.');

                    } else {
                        logWarn('⚠️ ', 'DISCONNECT', `Unknown reason (${statusCode}). Restarting pm2 in 5s...`);
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });
        }

        // Start with pairing phase
        await createSocket(true);

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
