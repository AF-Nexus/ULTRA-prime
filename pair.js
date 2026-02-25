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

router.get('/', async (req, res) => {
    let num = req.query.number;

    if (!num) {
        return res.status(400).json({ error: 'Phone number is required. Use ?number=2637XXXXXXXX' });
    }

    num = num.replace(/[^0-9]/g, '');

    if (num.length < 7) {
        return res.status(400).json({ error: 'Invalid phone number.' });
    }

    // Fresh auth dir for every pairing attempt
    try {
        if (fs.existsSync(AUTH_DIR)) {
            fs.emptyDirSync(AUTH_DIR);
        } else {
            fs.mkdirSync(AUTH_DIR, { recursive: true });
        }
    } catch (e) {
        console.error('[Auth Dir] Error:', e.message);
    }

    try {
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            Browsers,
            DisconnectReason
        } = await import('@whiskeysockets/baileys');

        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[Baileys] WA v${version.join('.')}, isLatest: ${isLatest}`);

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            logger,
            printQRInTerminal: false,

            // ✅ Keep connection alive — prevents browser/WA from dropping the session
            keepAliveIntervalMs: 10_000,          // ping WA every 10s
            connectTimeoutMs: 60_000,             // wait up to 60s to connect
            retryRequestDelayMs: 250,             // fast retry on failed requests
            maxMsgRetryCount: 5,                  // retry sending up to 5 times

            // ✅ Stable browser — Chrome on Ubuntu is least likely to be flagged/dropped
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false,           // don't mark online, reduces WA scrutiny

            // ✅ Prevent WA from thinking client is idle/stale
            fireInitQueries: true,
            generateHighQualityLinkPreview: false,
            syncFullHistory: false,
        });

        sock.ev.on('creds.update', saveCreds);

        let pairingCodeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            console.log('[Connection Update]', connection || 'event', { qr: !!qr, pairingCodeSent });

            // ✅ Request pairing code as soon as connecting or QR is available
            if (!pairingCodeSent && !sock.authState.creds.registered) {
                if (connection === 'connecting' || !!qr) {
                    pairingCodeSent = true;
                    try {
                        await delay(1500);
                        const code = await sock.requestPairingCode(num);
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        console.log(`[Pairing] Code for ${num}: ${formatted}`);
                        if (!res.headersSent) {
                            res.json({ code: formatted });
                        }
                    } catch (err) {
                        console.error('[Pairing] Error:', err.message);
                        pairingCodeSent = false;
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                        }
                    }
                }
            }

            // ✅ Connection open — upload creds immediately, no long waits
            if (connection === 'open') {
                console.log('[Connection] Open! Uploading creds...');
                try {
                    // ✅ Short delay — just enough for creds to be written to disk
                    // DO NOT use 10s delay here, that causes the WA session to look idle/stale
                    await delay(3000);

                    const credsFile = path.join(AUTH_DIR, 'creds.json');

                    // Quick retry loop if file isn't written yet
                    for (let i = 0; i < 8; i++) {
                        if (fs.existsSync(credsFile)) break;
                        console.log(`[Upload] Waiting for creds.json... (${i + 1}/8)`);
                        await delay(1000);
                    }

                    if (!fs.existsSync(credsFile)) {
                        throw new Error('creds.json was never written to disk.');
                    }

                    // ✅ Send a keep-alive presence so WA doesn't close connection during upload
                    await sock.sendPresenceUpdate('available');

                    const sessionId = await uploadToPastebin(credsFile, 'creds.json', 'json', '1');
                    console.log('[Upload] Session ID:', sessionId);

                    const userId = sock.user.id;
                    const sent = await sock.sendMessage(userId, { text: sessionId });
                    await sock.sendMessage(userId, { text: MESSAGE }, { quoted: sent });

                    console.log('[Done] Session sent to WhatsApp!');
                    await delay(1000);

                } catch (e) {
                    console.error('[Upload] Error:', e.message);
                }

                // Cleanup
                try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
            }

            // ✅ Disconnection handling
            if (connection === 'close') {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log('[Connection] Closed. Reason:', statusCode);

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('[Connection] Logged out.');
                    try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}

                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('[Connection] Restart required — this is normal after pairing.');

                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('[Connection] Replaced by another connection.');

                } else if (statusCode === DisconnectReason.timedOut) {
                    console.log('[Connection] Timed out — WA server did not respond.');

                } else if (statusCode === DisconnectReason.connectionClosed) {
                    console.log('[Connection] WA closed the connection.');

                } else {
                    console.log('[Connection] Unexpected close, restarting pm2 in 5s...');
                    await delay(5000);
                    exec('pm2 restart qasim');
                }
            }
        });

    } catch (err) {
        console.error('[Route] Fatal error:', err.message);
        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error. Try again.' });
        }
    }
});

module.exports = router;
