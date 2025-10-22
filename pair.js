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

const uploadToPastebin = require('./Paste');  // Assuming you have a function to upload to Pastebin

// Use dynamic import for Baileys
let makeWASocket, useMultiFileAuthState, delay, makeCacheableSignalKeyStore, Browsers, DisconnectReason;

(async () => {
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
    let number = req.query.number;

    async function SUHAIL() {
        try {
            // Wait for Baileys to load
            while (!makeWASocket) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys');
            
            const sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
                browser: Browsers.macOS("Desktop"),
            });

            if (!number) {
                return res.status(400).json({ error: "Please provide a phone number" });
            }

            // Remove any non-numeric characters
            number = number.replace(/[^0-9]/g, '');

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    // Handle QR code if needed
                }

                if (connection === "open") {
                    await delay(10000);

                    // Read session files
                    const credsPath = __dirname + '/auth_info_baileys/creds.json';
                    
                    if (fs.existsSync(credsPath)) {
                        const authData = await fs.readFile(credsPath, 'utf-8');
                        const SESSION_ID = Buffer.from(authData).toString('base64');

                        // Upload to Pastebin or your preferred service
                        const pasteUrl = await uploadToPastebin(SESSION_ID);

                        const successMessage = `${MESSAGE}\n\n📋 Session ID: ${pasteUrl || SESSION_ID.slice(0, 50) + '...'}`;

                        // Send success message to user
                        await sock.sendMessage(number + '@s.whatsapp.net', { 
                            text: successMessage 
                        });

                        // Clean up
                        fs.emptyDirSync(__dirname + '/auth_info_baileys');
                        
                        res.json({ 
                            success: true, 
                            message: "Session created successfully!",
                            sessionId: pasteUrl || SESSION_ID
                        });

                        process.exit(0);
                    }
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    
                    if (reason === DisconnectReason.badSession) {
                        console.log("Bad Session File, Please Delete and Scan Again");
                        res.status(500).json({ error: "Bad session, please try again" });
                    } else if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed, reconnecting...");
                        SUHAIL();
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server, reconnecting...");
                        SUHAIL();
                    } else if (reason === DisconnectReason.connectionReplaced) {
                        console.log("Connection Replaced, Another New Session Opened");
                        res.status(400).json({ error: "Connection replaced" });
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Device Logged Out, Please Scan Again.");
                        res.status(400).json({ error: "Logged out, please scan again" });
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        SUHAIL();
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut, Reconnecting...");
                        SUHAIL();
                    } else {
                        console.log("Unknown DisconnectReason:", reason);
                        res.status(500).json({ error: "Unknown error occurred" });
                    }
                }
            });

            return sock;

        } catch (error) {
            console.error("Error in SUHAIL function:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Internal server error: " + error.message });
            }
        }
    }

    await SUHAIL();
});

module.exports = router;
