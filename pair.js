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
├⬡ (⌐■_■)A BOT BY FRANKkaumbadev
╰────────────❒

> ✅ Thank you for choosing *EF-PRIME-MD V2*!
> 🔒 Your session is now active and secure`;

const uploadToPastebin = require('./Paste');

// Use baileys for pairing
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("baileys");

// Use @whiskeysockets/baileys for sending session ID
const {
    default: makeWASocketWhiskey,
    useMultiFileAuthState: useMultiFileAuthStateWhiskey,
    delay: delayWhiskey,
    makeCacheableSignalKeyStore: makeCacheableSignalKeyStoreWhiskey,
    Browsers: BrowsersWhiskey,
    DisconnectReason: DisconnectReasonWhiskey
} = require("@whiskeysockets/baileys");

// Ensure the directory is empty when the app starts
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function SUHAIL() {
        // Use baileys for pairing process
        const { state, saveCreds } = await useMultiFileAuthState(`./auth_info_baileys`);
        try {
            let Smd = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: Browsers.macOS("Safari"),
            });

            if (!Smd.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Smd.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            Smd.ev.on('creds.update', saveCreds);
            Smd.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await delay(10000);
                        if (fs.existsSync('./auth_info_baileys/creds.json'));

                        const auth_path = './auth_info_baileys/';
                        let user = Smd.user.id;

                        // Upload the creds.json to Pastebin directly
                        const credsFilePath = auth_path + 'creds.json';
                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                        const Scan_Id = pastebinUrl;

                        // Now switch to @whiskeysockets/baileys for sending the session ID
                        const { state: whiskeyState, saveCreds: whiskeySaveCreds } = await useMultiFileAuthStateWhiskey(`./auth_info_baileys`);
                        
                        let WhiskeySmd = makeWASocketWhiskey({
                            auth: {
                                creds: whiskeyState.creds,
                                keys: makeCacheableSignalKeyStoreWhiskey(whiskeyState.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                            },
                            printQRInTerminal: false,
                            logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                            browser: BrowsersWhiskey.macOS("Safari"),
                        });

                        // Send session ID using @whiskeysockets/baileys
                        let msgsss = await WhiskeySmd.sendMessage(user, { text: Scan_Id });
                        await WhiskeySmd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                        
                        await delayWhiskey(1000);
                        try { await fs.emptyDirSync(__dirname + '/auth_info_baileys'); } catch (e) {}

                    } catch (e) {
                        console.log("Error during file upload or message send: ", e);
                    }

                    await delay(100);
                    await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed!");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server!");
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut!");
                    } else {
                        console.log('Connection closed with bot. Please run again.');
                        console.log(reason);
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });

        } catch (err) {
            console.log("Error in SUHAIL function: ", err);
            exec('pm2 restart qasim');
            console.log("Service restarted due to error");
            SUHAIL();
            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
            if (!res.headersSent) {
                await res.send({ code: "Try After Few Minutes" });
            }
        }
    }

   return await SUHAIL();
});

module.exports = router;
