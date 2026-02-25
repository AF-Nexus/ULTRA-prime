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

    // Strip to digits only — E.164 without plus sign
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
        console.error('[Auth Dir] Error cleaning:', e.message);
    }

    try {
        // ✅ Dynamic import — baileys v7 is ESM only
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            fetchLatestBaileysVersion,
            makeCacheableSignalKeyStore,
            Browsers,
            DisconnectReason
        } = await import('@whiskeysockets/baileys');

        // Fetch latest WA version to avoid version mismatch issues
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`[Baileys] Using WA v${version.join('.')}, isLatest: ${isLatest}`);

        const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
        const logger = pino({ level: 'fatal' }).child({ level: 'fatal' });

        const sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger,
            browser: Browsers.ubuntu('Chrome'),
            markOnlineOnConnect: false,
        });

        sock.ev.on('creds.update', saveCreds);

        let pairingCodeSent = false;

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            console.log('[Connection Update]', { connection, hasPairingCode: pairingCodeSent, hasQR: !!qr });

            // ✅ THE CORRECT v7 FLOW:
            // Request pairing code as soon as socket starts connecting or QR is available
            // The key is: sock must exist but creds must NOT be registered yet
            if (!pairingCodeSent && !sock.authState.creds.registered) {
                if (connection === 'connecting' || !!qr) {
                    pairingCodeSent = true;
                    try {
                        // Small delay to ensure WA handshake has started
                        await delay(2000);
                        const code = await sock.requestPairingCode(num);
                        const formatted = code?.match(/.{1,4}/g)?.join('-') || code;
                        console.log(`[Pairing] Code: ${formatted}`);
                        if (!res.headersSent) {
                            res.json({ code: formatted });
                        }
                    } catch (err) {
                        console.error('[Pairing] Error:', err.message);
                        pairingCodeSent = false; // allow retry on next event
                        if (!res.headersSent) {
                            res.status(500).json({ error: 'Could not generate pairing code. Try again.' });
                        }
                    }
                }
            }

            // ✅ Connected — upload creds to Pastebin and DM the session ID
            if (connection === 'open') {
                console.log('[Connection] Open! Waiting for creds to be written...');
                try {
                    // Give baileys time to write all creds files
                    await delay(10000);

                    const credsFile = path.join(AUTH_DIR, 'creds.json');

                    // Retry waiting for creds.json
                    for (let i = 0; i < 10; i++) {
                        if (fs.existsSync(credsFile)) break;
                        console.log(`[Upload] Waiting for creds.json... attempt ${i + 1}`);
                        await delay(2000);
                    }

                    if (!fs.existsSync(credsFile)) {
                        throw new Error('creds.json was never created.');
                    }

                    const sessionId = await uploadToPastebin(credsFile, 'creds.json', 'json', '1');
                    console.log('[Upload] Session ID:', sessionId);

                    const userId = sock.user.id;
                    const sent = await sock.sendMessage(userId, { text: sessionId });
                    await sock.sendMessage(userId, { text: MESSAGE }, { quoted: sent });

                    console.log('[Done] Session sent to WhatsApp successfully!');
                    await delay(2000);

                } catch (e) {
                    console.error('[Upload] Error:', e.message);
                }

                // Cleanup auth dir
                try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
            }

            // ✅ Handle disconnection reasons properly
            if (connection === 'close') {
                const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log('[Connection] Closed. Status:', statusCode);

                if (statusCode === DisconnectReason.loggedOut) {
                    console.log('[Connection] Logged out. Clearing auth...');
                    try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}

                } else if (statusCode === DisconnectReason.restartRequired) {
                    console.log('[Connection] Restart required.');
                    // Do NOT call SUHAIL again here — this is a pairing session, not a persistent bot

                } else if (statusCode === DisconnectReason.connectionReplaced) {
                    console.log('[Connection] Connection replaced by another device.');

                } else if (statusCode === DisconnectReason.timedOut) {
                    console.log('[Connection] Timed out.');

                } else {
                    console.log('[Connection] Closed with code:', statusCode, '— restarting pm2...');
                    await delay(5000);
                    exec('pm2 restart qasim');
                }
            }
        });

    } catch (err) {
        console.error('[Route] Fatal error:', err.message);
        try { fs.emptyDirSync(AUTH_DIR); } catch (e) {}
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error. Try again in a few minutes.' });
        }
    }
});

module.exports = router;
