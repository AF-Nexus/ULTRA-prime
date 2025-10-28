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
    // Dynamic import of baileys
    const baileys = await import("@whiskeysockets/baileys");
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        delay,
        makeCacheableSignalKeyStore,
        Browsers,
        DisconnectReason
    } = baileys;

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
                    try {
                        console.log("✅ Connection opened!");
                        await delay(10000);
                        
                        const auth_path = './auth_info_baileys/';
                        const credsFilePath = auth_path + 'creds.json';
                        
                        // Check if creds.json exists
                        if (fs.existsSync(credsFilePath)) {
                            console.log("📄 Creds file found, processing...");
                            
                            let user = Smd.user.id;
                            console.log("👤 User ID:", user);

                            // Upload to Pastebin and get custom session ID
                            console.log("⏳ Uploading to Pastebin...");
                            const Scan_Id = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                            
                            console.log("🎉 Custom Session ID generated:", Scan_Id);

                            // Send session ID to user's WhatsApp
                            console.log("📤 Sending session ID to user...");
                            let msgsss = await Smd.sendMessage(user, { text: Scan_Id });
                            console.log("✅ Session ID sent successfully!");
                            
                            await delay(800);
                            
                            // Send confirmation message as quoted reply
                            console.log("📤 Sending confirmation message...");
                            await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                            console.log("✅ Confirmation message sent successfully!");
                            
                            await delay(1000);
                            
                            // Clean up
                            try { 
                                await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                                console.log("🧹 Cleaned up auth directory");
                            } catch (e) {
                                console.log("⚠️ Cleanup error:", e);
                            }
                        } else {
                            console.log("❌ Creds file not found at:", credsFilePath);
                        }

                    } catch (e) {
                        console.log("❌ Error during session generation or message send:", e);
                    }

                    await delay(100);
                    try {
                        await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                    } catch (e) {
                        console.log("⚠️ Final cleanup error:", e);
                    }
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("🔌 Connection closed. Reason code:", reason);
                    
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
            console.log("❌ Error in SUHAIL function:", err);
            exec('pm2 restart qasim');
            console.log("Service restarted due to error");
            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
            if (!res.headersSent) {
                await res.send({ code: "Try After Few Minutes" });
            }
        }
    }

    return await SUHAIL();
});

module.exports = router;
