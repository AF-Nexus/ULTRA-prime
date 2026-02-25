const express = require('express');
const fs = require('fs-extra');
const { exec } = require("child_process");
let router = express.Router();
const pino = require("pino");
const { Boom } = require("@hapi/boom");

const MESSAGE = process.env.MESSAGE || `
🚀 *_EF-PRIME-MD-ULTRA Session Activated_* 💻

╭─❒ *🎉 SESSION INFO* ❒
├⬡ 🆔 Session ID successfully generated!
├⬡ 🤖 Bot: EF-PRIME-MD-ULTRA V2
├⬡ 😎 Welcome to the next-gen experience!
╰────────────❒

> ✅ Thank you for choosing *EF-PRIME-MD V2*!
> 🔒 Your session is now active and secured`;

const uploadToPastebin = require('./Paste');

// Ensure the directory is empty when the app starts
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    // Validate number is provided
    if (!num) {
        return res.status(400).send({ error: "Phone number is required" });
    }

    // Clean number to E.164 format without plus sign
    num = num.replace(/[^0-9]/g, '');

    async function SUHAIL() {
        // Dynamic import for ESM-only baileys package
        const {
            default: makeWASocket,
            useMultiFileAuthState,
            delay,
            makeCacheableSignalKeyStore,
            Browsers,
            DisconnectReason
        } = await import("@whiskeysockets/baileys");

        const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys`);

        try {
            let Smd = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(
                        state.keys,
                        pino({ level: "fatal" }).child({ level: "fatal" })
                    ),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            Smd.ev.on('creds.update', saveCreds);

            // Track if pairing code was already requested
            let pairingCodeSent = false;

            Smd.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                // ✅ CORRECT v7 way: request pairing code when "connecting" or QR appears
                if ((connection === "connecting" || !!qr) && !pairingCodeSent && !Smd.authState.creds.registered) {
                    pairingCodeSent = true;
                    try {
                        await delay(1500);
                        const code = await Smd.requestPairingCode(num);
                        console.log("Pairing code generated:", code);
                        if (!res.headersSent) {
                            await res.send({ code });
                        }
                    } catch (err) {
                        console.error("Error requesting pairing code:", err);
                        if (!res.headersSent) {
                            res.status(500).send({ code: "Error generating pairing code. Try again." });
                        }
                    }
                }

                if (connection === "open") {
                    console.log("Connection opened! Uploading creds...");
                    try {
                        await delay(10000);

                        const credsFilePath = './auth_info_baileys/creds.json';

                        // Make sure creds file exists before uploading
                        if (!fs.existsSync(credsFilePath)) {
                            console.log("creds.json not found yet, waiting...");
                            await delay(3000);
                        }

                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                        const Scan_Id = pastebinUrl;

                        let user = Smd.user.id;
                        let msgsss = await Smd.sendMessage(user, { text: Scan_Id });
                        await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                        await delay(1000);

                    } catch (e) {
                        console.log("Error during file upload or message send:", e);
                    }

                    await delay(100);
                    try { fs.emptyDirSync(__dirname + '/auth_info_baileys'); } catch (e) {}
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("Connection closed, reason:", reason);

                    if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed!");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server!");
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut!");
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Device logged out!");
                        try { fs.emptyDirSync(__dirname + '/auth_info_baileys'); } catch (e) {}
                    } else {
                        console.log('Unexpected close, restarting...');
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });

        } catch (err) {
            console.log("Error in SUHAIL function:", err);
            exec('pm2 restart qasim');
            try { fs.emptyDirSync(__dirname + '/auth_info_baileys'); } catch (e) {}
            if (!res.headersSent) {
                await res.send({ code: "Try After Few Minutes if doesnt work contact Frankkaumbadev" });
            }
        }
    }

    return await SUHAIL();
});

module.exports = router;
