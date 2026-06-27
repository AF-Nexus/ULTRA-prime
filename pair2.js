const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const fetch = require('node-fetch');

let router = express.Router();

const MESSAGE = process.env.WAGOAT_MESSAGE || `
🐐 *_Wagoat Session Activated_* ⚡

╭─❒ *🎉 SESSION INFO* ❒
├⬡ 🆔 Session ID successfully generated!
├⬡ 🤖 Bot: Wagoat
├⬡ 😎 Welcome aboard!
╰────────────❒

> ✅ Thank you for choosing *Wagoat*!
> 🔒 Your session is now active and secured
> 👑 By Romeo Calyx X Frank Kaumba Dev`;

const AUTH_DIR = path.join(__dirname, 'auth_info_baileys_wagoat');

const PASTEBIN_KEYS = [
    'Pe8nyDTO5Jm4ZdKo3qlbKjaFSP53srbT',
    'c7Jo_q9xvCMAQsj1qihjLJBMBY2Er5--',
    'KpoS0JysNXgUSgCWH2hr__2OG7aJ30S_',
    'furii3L3ijdpwYB-vZ_jej7CxvNjFESk',
    'PS0uqmRdEQ3mSqNWD28lccEmQMz-eu7',
    '9L_JkdEp6u4yAa3Dwi9gnYxvZ2_HrXj-'
];

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

async function uploadWagoatSession(credsFilePath) {
    const content = fs.readFileSync(credsFilePath, 'utf8');
    let lastError = null;

    for (let i = 0; i < PASTEBIN_KEYS.length; i++) {
        try {
            const body = new URLSearchParams();
            body.append('api_dev_key', PASTEBIN_KEYS[i]);
            body.append('api_option', 'paste');
            body.append('api_paste_code', content);
            body.append('api_paste_name', 'Wagoat-Session');
            body.append('api_paste_format', 'json');
            body.append('api_paste_private', '1');
            body.append('api_paste_expire_date', 'N');

            const response = await fetch('https://pastebin.com/api/api_post.php', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const text = await response.text();
            if (!text.startsWith('https://pastebin.com/')) throw new Error(`Rejected: ${text}`);

            const pasteId = text.replace('https://pastebin.com/', '').trim();
            const sessionId = `Wagoat~${pasteId}`;
            logOk('✅', 'UPLOAD', `Session ID: ${sessionId}`);
            return sessionId;

        } catch (err) {
            logErr('❌', 'UPLOAD', `Key ${i + 1} failed: ${err.message}`);
            lastError = err;
        }
    }

    throw new Error(`All keys failed. Last: ${lastError?.message}`);
}

const silentLogger = pino({ level: 'silent' });
silentLogger.child = () => silentLogger;

if (fs.existsSync(AUTH_DIR)) {
    fs.emptyDirSync(AUTH_DIR);
}

function buildSocketConfig(version, state) {
    return {
        version,
        auth: state,
        logger: silentLogger,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '124.0.6367.82'],
        keepAliveIntervalMs: 30_000,
        connectTimeoutMs: 60_000,
        retryRequestDelayMs: 250,
        maxMsgRetryCount: 5,
        defaultQueryTimeoutMs: 0,
        markOnlineOnConnect: false,
        fireInitQueries: true,
        generateHighQualityLinkPreview: false,
        syncFullHistory: false,
        emitOwnEvents: false,
    };
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    if (!num) return res.status(400).json({ error: 'Phone number is required.' });

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 7) return res.status(400).json({ error: 'Invalid phone number.' });

    log('📞', 'PAIR REQUEST', `Incoming pairing request for +${num}`);

    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.emptyDirSync(AUTH_DIR);
        } else {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
        logOk('✅', 'AUTH DIR', 'Auth directory ready.');
    } catch (e) {
        logErr('❌', 'AUTH DIR', `Failed: ${e.message}`);
    }

    try {
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            DisconnectReason,
            jidNormalizedUser,
        } = await import('@whiskeysockets/baileys');

        const { version, isLatest } = await fetchLatestBaileysVersion();
        logOk('✅', 'VERSION', `WhatsApp v${version.join('.')} — isLatest: ${isLatest}`);

        let sessionUploaded = false;

        async function startPairing() {
            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

            const sock = makeWASocket(buildSocketConfig(version, {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
            }));

            sock.ev.on('creds.update', saveCreds);

            await delay(2000);

            try {
                const code = await sock.requestPairingCode(num);
                const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                logOk('🎯', 'PAIRING', `Code ready: ${C.yellow}${C.bright}${formatted}${C.reset}`);
                if (!res.headersSent) res.json({ code: formatted });
            } catch (err) {
                logErr('❌', 'PAIRING', `Failed to get pairing code: ${err.message}`);
                if (!res.headersSent) res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                return;
            }

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect, isNewLogin, receivedPendingNotifications } = update;

                if (connection) log('🔄', 'CONNECTION', `State → ${C.bright}${connection.toUpperCase()}${C.reset}`);
                if (isNewLogin) logOk('🆕', 'LOGIN', 'New login detected!');
                if (receivedPendingNotifications) log('📬', 'NOTIFICATIONS', 'Pending notifications received.');

                if (connection === 'open') logOk('🎉', 'CONNECTED', 'Pairing socket connected!');

                if (connection === 'close') {
                    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    logErr('🔴', 'DISCONNECTED', `Code: ${statusCode}`);

                    if (statusCode === DisconnectReason.restartRequired) {
                        logWarn('🔁', 'RECONNECT', 'Restart required — launching session phase...');
                        await delay(2000);
                        startSession().catch(err => logErr('❌', 'SESSION ERROR', err.message));
                    } else {
                        await delay(5000);
                        exec('pm2 restart wagoat');
                    }
                }
            });
        }

        async function startSession() {
            if (sessionUploaded) return;

            const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
            logOk('✅', 'SESSION', `Auth loaded. Registered: ${state.creds.registered}`);

            const sock = makeWASocket(buildSocketConfig(version, {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
            }));

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection) log('🔄', 'SESSION', `State → ${C.bright}${connection.toUpperCase()}${C.reset}`);

                if (connection === 'open' && !sessionUploaded) {
                    sessionUploaded = true;
                    logOk('🎉', 'SESSION', 'Session socket OPEN!');
                    log('👤', 'USER', `Logged in as: ${C.green}${sock.user?.id}${C.reset}`);

                    try {
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

                        await sock.sendPresenceUpdate('available');

                        log('🚀', 'UPLOAD', 'Compressing and uploading session as Wagoat~ format...');
                        const sessionId = await uploadWagoatSession(credsFile);
                        logOk('✅', 'UPLOAD', `Done! Session ID starts with: Wagoat~...`);

                        let sendJid;
                        try {
                            const [result] = await sock.onWhatsApp(`${num}@s.whatsapp.net`);
                            if (result?.exists && result?.jid) {
                                sendJid = result.jid;
                            } else {
                                throw new Error('Number not found on WhatsApp');
                            }
                        } catch (jidErr) {
                            logWarn('⚠️', 'JID', `Lookup failed — using fallback`);
                            sendJid = jidNormalizedUser(sock.user.id);
                        }

                        const sent = await sock.sendMessage(sendJid, { text: sessionId });
                        await sock.sendMessage(sendJid, { text: MESSAGE }, { quoted: sent });
                        logOk('🎊', 'DONE', 'Session ID and welcome message delivered!');

                        await delay(1000);

                    } catch (e) {
                        logErr('❌', 'UPLOAD ERROR', e.message);
                    }

                    try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                    logOk('✅', 'CLEANUP', 'Auth directory cleared.');
                }

                if (connection === 'close') {
                    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    logErr('🔴', 'SESSION CLOSED', `Code: ${statusCode}`);

                    if (statusCode === DisconnectReason.restartRequired) {
                        await delay(2000);
                        startSession().catch(err => logErr('❌', 'SESSION RETRY', err.message));
                    } else if (statusCode === DisconnectReason.loggedOut) {
                        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
                    } else {
                        await delay(5000);
                        exec('pm2 restart wagoat');
                    }
                }
            });
        }

        await startPairing();

    } catch (err) {
        logErr('💥', 'FATAL', err.message);
        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error. Try again.' });
    }
});

module.exports = router;
