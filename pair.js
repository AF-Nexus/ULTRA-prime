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
const baileys = require("baileys");

// Use @whiskeysockets/baileys for sending session ID
const whiskeysockets = require("@whiskeysockets/baileys");

// Ensure the directory is empty when the app starts
if (fs.existsSync('./auth_info_baileys')) {
    fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
    let num = req.query.number;

    async function SUHAIL() {
        // Use baileys for initial pairing
        const { state, saveCreds } = await baileys.useMultiFileAuthState(`./auth_info_baileys`);
        let activeSocket = null;
        
        try {
            // Create initial connection with baileys for pairing
            let Smd = baileys.default({
                auth: {
                    creds: state.creds,
                    keys: baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                browser: baileys.Browsers.macOS("Safari"),
            });

            activeSocket = Smd;

            // Handle pairing if not registered
            if (!Smd.authState.creds.registered) {
                await baileys.delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await Smd.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            // Save credentials updates
            Smd.ev.on('creds.update', saveCreds);
            
            Smd.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection === "open") {
                    try {
                        await baileys.delay(5000); // Wait for connection to stabilize
                        
                        // Verify connection is still active
                        if (!activeSocket || activeSocket.ws.readyState !== activeSocket.ws.OPEN) {
                            console.log("Connection lost during session generation");
                            return;
                        }

                        const auth_path = './auth_info_baileys/';
                        let user = Smd.user.id;

                        // Upload the creds.json to Pastebin
                        const credsFilePath = auth_path + 'creds.json';
                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                        const Scan_Id = pastebinUrl;

                        // Now gracefully close baileys connection and switch to whiskeysockets
                        console.log("Switching to WhiskeySockets for session ID delivery...");
                        
                        // Close the baileys connection properly
                        if (activeSocket) {
                            await activeSocket.logout();
                            activeSocket = null;
                        }

                        // Small delay before creating new connection
                        await baileys.delay(2000);

                        // Create new connection with whiskeysockets using the same auth state
                        const { state: whiskeyState, saveCreds: whiskeySaveCreds } = await whiskeysockets.useMultiFileAuthState(`./auth_info_baileys`);
                        
                        let WhiskeySmd = whiskeysockets.default({
                            auth: {
                                creds: whiskeyState.creds,
                                keys: whiskeysockets.makeCacheableSignalKeyStore(whiskeyState.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
                            },
                            printQRInTerminal: false,
                            logger: pino({ level: "fatal" }).child({ level: "fatal" }),
                            browser: whiskeysockets.Browsers.macOS("Safari"),
                        });

                        activeSocket = WhiskeySmd;

                        // Wait for whiskeysockets connection to establish
                        const connectionPromise = new Promise((resolve, reject) => {
                            const timeout = setTimeout(() => {
                                reject(new Error("WhiskeySockets connection timeout"));
                            }, 30000);

                            WhiskeySmd.ev.on("connection.update", (update) => {
                                if (update.connection === "open") {
                                    clearTimeout(timeout);
                                    resolve();
                                }
                                if (update.connection === "close") {
                                    clearTimeout(timeout);
                                    reject(new Error("WhiskeySockets connection failed"));
                                }
                            });
                        });

                        // Wait for connection to be established
                        await connectionPromise;
                        
                        // Send session ID using whiskeysockets with real connection
                        console.log("Sending session ID via WhiskeySockets...");
                        let msgsss = await WhiskeySmd.sendMessage(user, { text: Scan_Id });
                        await WhiskeySmd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
                        
                        console.log("Session ID sent successfully!");
                        
                        // Clean up
                        await whiskeysockets.delay(2000);
                        await WhiskeySmd.logout();
                        
                        try { 
                            await fs.emptyDirSync(__dirname + '/auth_info_baileys'); 
                        } catch (e) {
                            console.log("Cleanup error:", e);
                        }

                    } catch (e) {
                        console.log("Error during session ID delivery: ", e);
                        
                        // Cleanup on error
                        if (activeSocket) {
                            try {
                                await activeSocket.logout();
                            } catch (logoutErr) {
                                console.log("Error during cleanup logout:", logoutErr);
                            }
                        }
                        
                        try { 
                            await fs.emptyDirSync(__dirname + '/auth_info_baileys'); 
                        } catch (e) {}
                    }
                }

                // Handle connection closures
                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log(`Connection closed with reason: ${reason}`);
                    
                    if (reason === baileys.DisconnectReason.connectionClosed) {
                        console.log("Connection closed!");
                    } else if (reason === baileys.DisconnectReason.connectionLost) {
                        console.log("Connection Lost from Server!");
                    } else if (reason === baileys.DisconnectReason.restartRequired) {
                        console.log("Restart Required, Restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === baileys.DisconnectReason.timedOut) {
                        console.log("Connection TimedOut!");
                    } else if (reason === baileys.DisconnectReason.loggedOut) {
                        console.log("Device logged out - this is expected during library switch");
                    } else {
                        console.log('Connection closed with bot. Please run again.');
                        console.log(reason);
                        await baileys.delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });

        } catch (err) {
            console.log("Error in SUHAIL function: ", err);
            
            // Cleanup on error
            if (activeSocket) {
                try {
                    await activeSocket.logout();
                } catch (e) {}
            }
            
            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
            
            if (!res.headersSent) {
                await res.send({ code: "Try After Few Minutes" });
            }
            
            // Restart service
            exec('pm2 restart qasim');
            console.log("Service restarted due to error");
        }
    }

   return await SUHAIL();
});

module.exports = router;
