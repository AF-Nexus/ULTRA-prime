const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const pino = require('pino');
const zlib = require('zlib');
const { Boom } = require('@hapi/boom');

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

const silentLogger = pino({ level: 'silent' });
silentLogger.child = () => silentLogger;

function removeFile(filePath) {
    try {
        if (!fs.existsSync(filePath)) return;
        fs.rmSync(filePath, { recursive: true, force: true });
    } catch (e) {}
}

const PASTEBIN_KEYS = [
    'Pe8nyDTO5Jm4ZdKo3qlbKjaFSP53srbT',
    'c7Jo_q9xvCMAQsj1qihjLJBMBY2Er5--',
    'KpoS0JysNXgUSgCWH2hr__2OG7aJ30S_',
    'furii3L3ijdpwYB-vZ_jej7CxvNjFESk',
    'PS0uqmRdEQ3mSqNWD28lccEmQMz-eu7',
    '9L_JkdEp6u4yAa3Dwi9gnYxvZ2_HrXj-'
];

async function uploadToPastebin(text) {
    let lastError = null;
    for (let i = 0; i < PASTEBIN_KEYS.length; i++) {
        try {
            const body = new URLSearchParams();
            body.append('api_dev_key', PASTEBIN_KEYS[i]);
            body.append('api_option', 'paste');
            body.append('api_paste_code', text);
            body.append('api_paste_name', 'Wagoat-Session');
            body.append('api_paste_format', 'text');
            body.append('api_paste_private', '1');
            body.append('api_paste_expire_date', 'N');
            const response = await fetch('https://pastebin.com/api/api_post.php', {
                method: 'POST',
                body,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const text2 = await response.text();
            if (!text2.startsWith('https://pastebin.com/')) throw new Error(`Rejected: ${text2}`);
            return text2.replace('https://pastebin.com/', '').trim();
        } catch (err) {
            lastError = err;
        }
    }
    throw new Error(`All Pastebin keys failed: ${lastError?.message}`);
}

async function generateSessionId(credsPath) {
    const credsContent = fs.readFileSync(credsPath);
    const base64Gzip = zlib.gzipSync(credsContent).toString('base64');
    const payload = `Wagoat~${base64Gzip}`;
    const pasteId = await uploadToPastebin(payload);
    return `Wagoat~${pasteId}`;
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

    const sessionDir = path.join(AUTH_DIR, num);
    removeFile(sessionDir);

    try {
        fs.mkdirSync(sessionDir, { recursive: true });
    } catch (e) {}

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

        const { version } = await fetchLatestBaileysVersion();

        async function initiateSession() {
            const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

            const sock = makeWASocket(buildSocketConfig(version, {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
            }));

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === 'open') {
                    try {
                        await delay(5000);

                        const credsFile = path.join(sessionDir, 'creds.json');

                        for (let i = 0; i < 10; i++) {
                            if (fs.existsSync(credsFile)) break;
                            await delay(1000);
                        }

                        if (!fs.existsSync(credsFile)) throw new Error('creds.json not found');

                        const userJid = jidNormalizedUser(num + '@s.whatsapp.net');

                        await sock.sendMessage(userJid, {
                            document: fs.readFileSync(credsFile),
                            mimetype: 'application/json',
                            fileName: 'creds.json'
                        });

                        const sessionId = await generateSessionId(credsFile);

                        const sent = await sock.sendMessage(userJid, {
                            text: `*Wagoat Session ID:*\n\n${sessionId}\n\n⚠️ Do not share this with anyone!`
                        });

                        await sock.sendMessage(userJid, { text: MESSAGE }, { quoted: sent });

                        if (sessionId.startsWith('Wagoat~')) {
                            await sock.sendMessage(userJid, {
                                text: 'Tap the button below to copy your session ID.',
                                footer: 'Wagoat | Romeo Calyx X Frank Kaumba Dev',
                                viewOnce: true,
                                interactiveButtons: [
                                    {
                                        name: 'cta_copy',
                                        buttonParamsJson: JSON.stringify({
                                            display_text: '📋 COPY SESSION ID',
                                            copy_code: sessionId
                                        })
                                    }
                                ],
                                contextInfo: {
                                    deviceListMetadata: {},
                                    deviceListMetadataVersion: 2
                                }
                            });
                        }

                    } catch (e) {
                        console.error('Session delivery error:', e.message);
                    } finally {
                        await delay(2000);
                        removeFile(sessionDir);
                    }
                }

                if (connection === 'close') {
                    const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                        removeFile(sessionDir);
                    } else {
                        initiateSession();
                    }
                }
            });

            if (!sock.authState.creds.registered) {
                await delay(3000);
                try {
                    let code = await sock.requestPairingCode(num);
                    code = code?.match(/.{1,4}/g)?.join('-') || code;
                    if (!res.headersSent) res.json({ code });
                } catch (err) {
                    if (!res.headersSent) res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                }
            }
        }

        await initiateSession();

    } catch (err) {
        console.error('Fatal:', err.message);
        removeFile(sessionDir);
        if (!res.headersSent) res.status(500).json({ error: 'Internal server error.' });
    }
});

process.on('uncaughtException', (err) => {
    const e = String(err);
    if (e.includes('conflict')) return;
    if (e.includes('not-authorized')) return;
    if (e.includes('Socket connection timeout')) return;
    if (e.includes('rate-overlimit')) return;
    if (e.includes('Connection Closed')) return;
    if (e.includes('Timed Out')) return;
    if (e.includes('Value not found')) return;
    if (e.includes('Stream Errored')) return;
    if (e.includes('statusCode: 515')) return;
    if (e.includes('statusCode: 503')) return;
    console.error('Uncaught exception:', err);
});

module.exports = router;
