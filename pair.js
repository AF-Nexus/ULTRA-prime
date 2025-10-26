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

    if (!num) {
        return res.status(400).json({ error: "Please provide a phone number using ?number=YOUR_NUMBER" });
    }

    // Clean the number
    num = num.replace(/[^0-9]/g, '');

    if (num.length < 10) {
        return res.status(400).json({ error: "Invalid phone number" });
    }

    async function SUHAIL() {
        const sessionDir = __dirname + '/auth_info_baileys/' + num;
        
        // Create unique session directory for this number
        if (!fs.existsSync(sessionDir)) {
            fs.mkdirSync(sessionDir, { recursive: true });
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        try {
            let Smd = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Safari"),
                generateHighQualityLinkPreview: true,
            });

            // Request pairing code if not registered
            if (!Smd.authState.creds.registered) {
                await delay(1500);
                
                try {
                    const code = await Smd.requestPairingCode(num);
                    console.log(`✅ Pairing code generated for ${num}: ${code}`);
                    
                    // Send pairing code to user immediately
                    if (!res.headersSent) {
                        res.json({ 
                            success: true,
                            code: code,
                            message: "Enter this code in WhatsApp: Linked Devices > Link a Device",
                            note: "Waiting for you to enter the code... Keep this page open!"
                        });
                    }
                } catch (error) {
                    console.error("❌ Error requesting pairing code:", error);
                    if (!res.headersSent) {
                        return res.status(500).json({ 
                            error: "Failed to generate pairing code",
                            details: error.message 
                        });
                    }
                }
            }

            // Save credentials when updated
            Smd.ev.on('creds.update', saveCreds);
            
            // Handle connection updates
            Smd.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                if (connection === "open") {
                    console.log("✅ Connection established successfully for " + num);
                    
                    try {
                        await delay(3000);
                        
                        const credsPath = sessionDir + '/creds.json';
                        
                        if (fs.existsSync(credsPath)) {
                            let user = Smd.user.id;
                            
                            console.log("📤 Sending session to user:", user);

                            // Read credentials file
                            const credsData = await fs.readFile(credsPath, 'utf8');
                            
                            // Create session ID - try Pastebin first, fallback to base64
                            let sessionId;
                            try {
                                // Upload to Pastebin (pass file path, not file content)
                                sessionId = await uploadToPastebin(credsPath, `EF_PRIME_${num}`, 'json', '1');
                                console.log("✅ Session uploaded to Pastebin:", sessionId);
                            } catch (err) {
                                console.log("⚠️ Pastebin upload failed:", err.message);
                                console.log("📦 Using base64 encoding instead");
                                // Fallback: encode entire creds as base64
                                sessionId = Buffer.from(credsData).toString('base64');
                            }

                            if (!sessionId || sessionId.length < 10) {
                                console.log("❌ Session ID generation failed!");
                                sessionId = Buffer.from(credsData).toString('base64');
                            }

                            // Send session ID to user's WhatsApp
                            let msgResponse = await Smd.sendMessage(user, { 
                                text: `*✅ EF-PRIME-MD Session Created!*\n\n*Session ID:*\n${sessionId}\n\n_💾 Save this Session ID securely!_\n_🔒 Do not share with anyone!_` 
                            });
                            
                            await delay(1500);
                            
                            // Send welcome message
                            await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgResponse });
                            
                            console.log("✅ Session sent successfully to user");

                            await delay(2000);
                            
                            // Cleanup session directory
                            try { 
                                await fs.emptyDir(sessionDir);
                                await fs.rmdir(sessionDir);
                                console.log("🧹 Cleaned up session directory");
                            } catch (e) {
                                console.log("⚠️ Cleanup error:", e.message);
                            }

                            // Gracefully logout
                            setTimeout(() => {
                                Smd.end();
                                console.log("👋 Connection closed");
                            }, 3000);
                            
                        } else {
                            console.log("❌ Creds file not found at:", credsPath);
                        }

                    } catch (e) {
                        console.log("❌ Error during session creation:", e);
                    }
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    
                    console.log("🔴 Connection closed. Reason code:", reason);
                    
                    if (reason === DisconnectReason.badSession) {
                        console.log("❌ Bad Session File");
                        try {
                            await fs.emptyDir(sessionDir);
                            await fs.rmdir(sessionDir);
                        } catch (e) {}
                    } else if (reason === DisconnectReason.connectionClosed) {
                        console.log("🔴 Connection closed normally");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("🔴 Connection Lost from Server, reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("🔴 Device Logged Out");
                        try {
                            await fs.emptyDir(sessionDir);
                            await fs.rmdir(sessionDir);
                        } catch (e) {}
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("🔄 Restart Required, restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("⏱️ Connection TimedOut, reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else {
                        console.log('🔴 Connection closed with reason:', reason);
                    }
                }
            });

            // Keep the connection alive
            console.log("⏳ Waiting for user to enter pairing code...");

        } catch (err) {
            console.log("❌ Error in SUHAIL function:", err);
            
            // Cleanup on error
            try {
                if (fs.existsSync(sessionDir)) {
                    await fs.emptyDir(sessionDir);
                    await fs.rmdir(sessionDir);
                }
            } catch (e) {}
            
            if (!res.headersSent) {
                return res.status(500).json({ 
                    error: "Failed to create session",
                    message: err.message 
                });
            }
        }
    }

    return await SUHAIL();
});

module.exports = router;
