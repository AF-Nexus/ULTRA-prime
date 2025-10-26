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
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
        try {
            let Smd = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }),
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
                    console.log("✅✅✅ CONNECTION OPENED! ✅✅✅");
                    
                    try {
                        console.log("⏳ Waiting 10 seconds for stability...");
                        await delay(10000);
                        
                        console.log("📁 Checking files...");
                        const credsFilePath = './auth_info_baileys/creds.json';
                        
                        if (!fs.existsSync(credsFilePath)) {
                            console.log("❌ creds.json NOT FOUND!");
                            return;
                        }
                        
                        console.log("✅ creds.json exists!");
                        
                        // Get user info
                        const user = Smd.user.id;
                        console.log("👤 USER ID:", user);
                        console.log("📱 USER NAME:", Smd.user.name);
                        console.log("📱 VERIFY:", Smd.user.verifiedName);

                        // Upload to Pastebin
                        console.log("📤 Uploading to Pastebin...");
                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                        console.log("✅ PASTEBIN SUCCESS:", pastebinUrl);

                        // Try multiple message sending methods
                        console.log("\n🔥 ATTEMPTING MESSAGE SEND - METHOD 1 (Simple Text)");
                        try {
                            const msg1 = await Smd.sendMessage(user, { 
                                text: pastebinUrl 
                            });
                            console.log("✅ METHOD 1 SUCCESS!");
                            console.log("Response:", JSON.stringify(msg1, null, 2));
                            
                            await delay(2000);
                            
                            console.log("\n🔥 ATTEMPTING MESSAGE SEND - METHOD 2 (Quoted)");
                            const msg2 = await Smd.sendMessage(user, { 
                                text: MESSAGE 
                            }, { 
                                quoted: msg1 
                            });
                            console.log("✅ METHOD 2 SUCCESS!");
                            console.log("Response:", JSON.stringify(msg2, null, 2));
                            
                        } catch (method1Error) {
                            console.log("❌ METHOD 1 FAILED!");
                            console.log("Error:", method1Error.message);
                            console.log("Stack:", method1Error.stack);
                            
                            // Try alternative method
                            console.log("\n🔥 ATTEMPTING MESSAGE SEND - METHOD 3 (Combined)");
                            try {
                                const msg3 = await Smd.sendMessage(user, { 
                                    text: `SESSION ID:\n\n${pastebinUrl}\n\n${MESSAGE}`
                                });
                                console.log("✅ METHOD 3 SUCCESS!");
                                console.log("Response:", JSON.stringify(msg3, null, 2));
                            } catch (method3Error) {
                                console.log("❌ METHOD 3 ALSO FAILED!");
                                console.log("Error:", method3Error.message);
                                
                                // Last resort - send to different format
                                console.log("\n🔥 ATTEMPTING MESSAGE SEND - METHOD 4 (JID Format)");
                                try {
                                    const jid = user.includes('@') ? user : `${user}@s.whatsapp.net`;
                                    console.log("Using JID:", jid);
                                    const msg4 = await Smd.sendMessage(jid, { 
                                        text: pastebinUrl
                                    });
                                    console.log("✅ METHOD 4 SUCCESS!");
                                    console.log("Response:", JSON.stringify(msg4, null, 2));
                                } catch (method4Error) {
                                    console.log("❌ ALL METHODS FAILED!");
                                    console.log("Final Error:", method4Error.message);
                                }
                            }
                        }
                        
                        console.log("\n🧹 Starting cleanup...");
                        await delay(1000);
                        try { 
                            await fs.emptyDirSync(__dirname + '/auth_info_baileys'); 
                            console.log("✅ Cleanup done!");
                        } catch (e) {
                            console.log("⚠️ Cleanup error:", e.message);
                        }

                    } catch (e) {
                        console.log("\n❌❌❌ MAJOR ERROR ❌❌❌");
                        console.log("Error name:", e.name);
                        console.log("Error message:", e.message);
                        console.log("Full stack:", e.stack);
                    }

                    await delay(100);
                    try {
                        await fs.emptyDirSync(__dirname + '/auth_info_baileys');
                    } catch (e) {}
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("🔴 Connection closed. Reason:", reason);
                    
                    if (reason === DisconnectReason.connectionClosed) {
                        console.log("Connection closed normally");
                    } else if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost, reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut, reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else {
                        console.log('Connection closed with reason:', reason);
                        await delay(5000);
                        exec('pm2 restart qasim');
                    }
                }
            });

        } catch (err) {
            console.log("❌ Error in SUHAIL function:", err.message);
            console.log("Stack:", err.stack);
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
