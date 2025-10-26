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

// Dynamic import of Baileys (ES Module)
let makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, DisconnectReason;

// Load Baileys asynchronously
const loadBaileys = (async () => {
    const baileys = await import("@whiskeysockets/baileys");
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    delay = baileys.delay;
    makeCacheableSignalKeyStore = baileys.makeCacheableSignalKeyStore;
    Browsers = baileys.Browsers;
    DisconnectReason = baileys.DisconnectReason;
})();

// Ensure the directory is empty when the app starts
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
    // Wait for Baileys to load
    await loadBaileys;

    let num = req.query.number;

    async function SUHAIL() {
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
                    console.log("✅ CONNECTION OPENED!");
                    
                    try {
                        console.log("⏳ Waiting 10 seconds...");
                        await delay(10000);
                        
                        console.log("📁 Checking for creds.json...");
                        const auth_path = './auth_info_baileys/';
                        const credsFilePath = auth_path + 'creds.json';
                        
                        if (!fs.existsSync(credsFilePath)) {
                            console.log("❌ ERROR: creds.json not found!");
                            return;
                        }
                        
                        console.log("✅ creds.json found!");
                        console.log("👤 User ID:", Smd.user.id);
                        console.log("📱 User Name:", Smd.user.name);
                        
                        let user = Smd.user.id;

                        console.log("📤 Uploading to Pastebin...");
                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                        console.log("✅ Pastebin URL:", pastebinUrl);

                        const Scan_Id = pastebinUrl;
                        
                        console.log("📨 Sending session ID to user:", user);
                        console.log("📋 Session ID to send:", Scan_Id);
                        
                        let msgsss = await Smd.sendMessage(user, { text: Scan_Id });
                        console.log("✅ First message sent! Response:", msgsss);
                        
                        console.log("📨 Sending welcome message...");
                        await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                        console.log("✅ Welcome message sent!");
                        
                        await delay(1000);
                        
                        console.log("🧹 Cleaning up...");
                        try { 
                            await fs.emptyDirSync(__dirname + '/auth_info_baileys'); 
                            console.log("✅ Cleanup complete!");
                        } catch (e) {
                            console.log("⚠️ Cleanup error:", e);
                        }

                    } catch (e) {
                        console.log("❌ ERROR during file upload or message send:");
                        console.log("Error name:", e.name);
                        console.log("Error message:", e.message);
                        console.log("Full error:", e);
                    }

                    await delay(100);
                    await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("🔴 Connection closed. Reason code:", reason);
                    
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
            console.log("❌ Error in SUHAIL function: ", err);
            console.log("Error details:", err.message);
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
