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
        return res.status(400).json({ error: "Invalid phone number. Please provide a valid number without spaces or special characters." });
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

            // Check if already registered
            if (!Smd.authState.creds.registered) {
                await delay(2000);
                
                try {
                    // Request pairing code from WhatsApp
                    const code = await Smd.requestPairingCode(num);
                    console.log(`Pairing code for ${num}: ${code}`);
                    
                    if (!res.headersSent) {
                        return res.json({ 
                            success: true,
                            code: code,
                            message: "Enter this code in WhatsApp > Linked Devices > Link a Device",
                            number: num
                        });
                    }
                } catch (error) {
                    console.error("Error requesting pairing code:", error);
                    if (!res.headersSent) {
                        return res.status(500).json({ 
                            error: "Failed to generate pairing code. Please check the phone number and try again.",
                            details: error.message 
                        });
                    }
                }
            }

            Smd.ev.on('creds.update', saveCreds);
            
            Smd.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    console.log("Connection established for " + num);
                    
                    try {
                        await delay(5000);
                        
                        const credsPath = sessionDir + '/creds.json';
                        
                        if (fs.existsSync(credsPath)) {
                            let user = Smd.user.id;

                            // Read and encode session file
                            const credsData = await fs.readFile(credsPath, 'utf8');
                            
                            // Upload the creds.json to Pastebin
                            const pastebinUrl = await uploadToPastebin(credsPath, `session_${num}`, 'json', '1');

                            const sessionId = pastebinUrl || credsData;

                            // Send session ID to user
                            let msgResponse = await Smd.sendMessage(user, { 
                                text: `*Session ID:*\n\n${sessionId}\n\n_Save this Session ID securely!_` 
                            });
                            
                            await delay(1000);
                            
                            // Send welcome message
                            await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgResponse });
                            
                            console.log("Session created successfully for " + num);

                            await delay(2000);
                            
                            // Cleanup
                            try { 
                                await fs.emptyDir(sessionDir);
                                await fs.rmdir(sessionDir);
                            } catch (e) {
                                console.log("Cleanup error:", e);
                            }

                            // Close connection gracefully
                            await Smd.logout();
                            
                        } else {
                            console.log("Creds file not found!");
                        }

                    } catch (e) {
                        console.log("Error during session creation: ", e);
                    }
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    
                    console.log("Connection closed. Reason:", reason);
                    
                    if (reason === DisconnectReason.badSession) {
                        console.log("Bad Session File, deleting...");
                        try {
                            await fs.emptyDir(sessionDir);
                            await fs.rmdir(sessionDir);
                        } catch (e) {}
                    } else if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed!");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server!");
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Device Logged Out!");
                        try {
                            await fs.emptyDir(sessionDir);
                            await fs.rmdir(sessionDir);
                        } catch (e) {}
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut!");
                    } else {
                        console.log('Connection closed. Reason:', reason);
                    }
                }
            });

        } catch (err) {
            console.log("Error in SUHAIL function: ", err);
            
            // Cleanup on error
            try {
                await fs.emptyDir(sessionDir);
                await fs.rmdir(sessionDir);
            } catch (e) {}
            
            if (!res.headersSent) {
                return res.status(500).json({ 
                    error: "Failed to create session",
                    message: "Please try again after a few minutes",
                    details: err.message 
                });
            }
        }
    }

    return await SUHAIL();
});

module.exports = router;
