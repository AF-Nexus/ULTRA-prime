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
                    console.log("✅ PAIRING CONNECTION OPENED!");
                    
                    try {
                        await delay(5000);
                        
                        const credsFilePath = './auth_info_baileys/creds.json';
                        
                        if (!fs.existsSync(credsFilePath)) {
                            console.log("❌ creds.json NOT FOUND!");
                            return;
                        }
                        
                        console.log("✅ Credentials saved!");
                        const user = Smd.user.id;
                        console.log("👤 User:", user);

                        // Close the pairing connection
                        console.log("🔌 Closing pairing connection...");
                        Smd.end();
                        await delay(2000);

                        // Upload to Pastebin first
                        console.log("📤 Uploading to Pastebin...");
                        const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
                        console.log("✅ Pastebin URL:", pastebinUrl);

                        // Now login AGAIN using the saved credentials
                        console.log("\n🔄 LOGGING IN WITH SAVED CREDENTIALS...");
                        const { state: newState, saveCreds: newSaveCreds } = await useMultiFileAuthState('./auth_info_baileys');
                        
                        const newSock = makeWASocket({
                            auth: {
                                creds: newState.creds,
                                keys: makeCacheableSignalKeyStore(newState.keys, pino({ level: "silent" })),
                            },
                            printQRInTerminal: false,
                            logger: pino({ level: "silent" }),
                            browser: Browsers.macOS("Safari"),
                        });

                        newSock.ev.on('creds.update', newSaveCreds);

                        // Command handler
                        newSock.ev.on("messages.upsert", async ({ messages }) => {
                            try {
                                const msg = messages[0];
                                if (!msg.message) return;
                                
                                const from = msg.key.remoteJid;
                                const sender = msg.key.participant || msg.key.remoteJid;
                                const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
                                
                                // Only respond to self-messages (DM to self)
                                if (from !== newSock.user.id) return;
                                
                                // Check if message starts with prefix
                                if (!messageText.startsWith('.')) return;
                                
                                const command = messageText.slice(1).trim().toLowerCase();
                                
                                console.log("📩 Command received:", command);
                                
                                // Command responses
                                if (command === 'menu' || command === 'help') {
                                    const menuText = `╭━━━━━━━━━━━━━━━━━━╮
┃ *EF-PRIME-MD MENU* 💻
╰━━━━━━━━━━━━━━━━━━╯

*Available Commands:*

┌─❒ *.menu*
│ Display this menu
│
├─❒ *.sessionid*
│ View your session ID
│
├─❒ *.help*
│ Get help information
│
└─❒ *.about*
   Bot information

━━━━━━━━━━━━━━━━━━
💡 *Tip:* Keep your session ID safe!
🔒 Never share it with anyone!
━━━━━━━━━━━━━━━━━━`;
                                    
                                    await newSock.sendMessage(from, { text: menuText });
                                    console.log("✅ Menu sent!");
                                    
                                } else if (command === 'sessionid' || command === 'session') {
                                    const sessionText = `╭━━━━━━━━━━━━━━━━━━╮
┃ *YOUR SESSION ID* 🔑
╰━━━━━━━━━━━━━━━━━━╯

${pastebinUrl}

━━━━━━━━━━━━━━━━━━
⚠️ *IMPORTANT SECURITY NOTICE:*

🔒 This is YOUR personal session ID
⛔ NEVER share this with anyone
💾 Save it in a secure location
🔐 Anyone with this can access your bot

━━━━━━━━━━━━━━━━━━`;
                                    
                                    await newSock.sendMessage(from, { text: sessionText });
                                    console.log("✅ Session ID sent!");
                                    
                                } else if (command === 'about' || command === 'info') {
                                    const aboutText = `╭━━━━━━━━━━━━━━━━━━╮
┃ *EF-PRIME-MD-ULTRA* 🤖
╰━━━━━━━━━━━━━━━━━━╯

*Version:* V2.0
*Status:* ✅ Active
*Session:* Connected

━━━━━━━━━━━━━━━━━━
🚀 *Features:*
• Secure session management
• Self-message interface
• Command system
• Auto-save credentials

━━━━━━━━━━━━━━━━━━
📱 *Support:*
Type *.menu* for all commands
Type *.help* for assistance

━━━━━━━━━━━━━━━━━━`;
                                    
                                    await newSock.sendMessage(from, { text: aboutText });
                                    console.log("✅ About sent!");
                                    
                                } else {
                                    // Unknown command
                                    const unknownText = `❌ *Unknown Command*

"${messageText}" is not recognized.

Type *.menu* to see all available commands.`;
                                    
                                    await newSock.sendMessage(from, { text: unknownText });
                                    console.log("⚠️ Unknown command response sent");
                                }
                                
                            } catch (cmdError) {
                                console.log("❌ Command handler error:", cmdError.message);
                            }
                        });

                        newSock.ev.on("connection.update", async (update) => {
                            const { connection: newConnection } = update;

                            if (newConnection === "open") {
                                console.log("✅ LOGGED IN SUCCESSFULLY AS USER!");
                                console.log("👤 Logged in as:", newSock.user.id);

                                try {
                                    await delay(2000);

                                    // Now send message to self
                                    console.log("📨 Sending session ID to self...");
                                    const msg1 = await newSock.sendMessage(newSock.user.id, { 
                                        text: pastebinUrl 
                                    });
                                    console.log("✅ Session ID sent!");

                                    await delay(1000);

                                    console.log("📨 Sending welcome message...");
                                    await newSock.sendMessage(newSock.user.id, { 
                                        text: MESSAGE 
                                    }, { 
                                        quoted: msg1 
                                    });
                                    console.log("✅ Welcome message sent!");

                                    await delay(1000);

                                    // Send command menu
                                    console.log("📨 Sending command menu...");
                                    const commandInfo = `╭━━━━━━━━━━━━━━━━━━╮
┃ *QUICK START GUIDE* 📖
╰━━━━━━━━━━━━━━━━━━╯

🎯 *Your session is ready!*

You can now use commands by typing them in this chat:

• *.menu* - View all commands
• *.sessionid* - Get your session ID
• *.help* - Get help

━━━━━━━━━━━━━━━━━━
💡 Type *.menu* to get started!
━━━━━━━━━━━━━━━━━━`;
                                    
                                    await newSock.sendMessage(newSock.user.id, { 
                                        text: commandInfo 
                                    });
                                    console.log("✅ Command menu sent!");

                                    console.log("\n⏰ Session will stay active for commands...");
                                    console.log("🔄 User can now use commands by messaging themselves");

                                    // Keep connection alive for 5 minutes to allow commands
                                    await delay(300000); // 5 minutes

                                    // Then logout and cleanup
                                    console.log("\n👋 Session timeout - Logging out...");
                                    await newSock.logout();
                                    
                                    await delay(1000);
                                    
                                    console.log("🧹 Cleaning up...");
                                    try { 
                                        await fs.emptyDirSync(__dirname + '/auth_info_baileys'); 
                                        console.log("✅ All done!");
                                    } catch (e) {
                                        console.log("⚠️ Cleanup error:", e.message);
                                    }

                                } catch (sendError) {
                                    console.log("❌ Error sending message:", sendError.message);
                                    console.log(sendError.stack);
                                }
                            }

                            if (newConnection === "close") {
                                console.log("🔴 New connection closed");
                            }
                        });

                    } catch (e) {
                        console.log("❌ ERROR:", e.message);
                        console.log(e.stack);
                    }
                }

                if (connection === "close") {
                    let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
                    console.log("🔴 Pairing connection closed. Reason:", reason);
                    
                    if (reason === DisconnectReason.connectionLost) {
                        console.log("Connection Lost, reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.restartRequired) {
                        console.log("Restart Required, restarting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.timedOut) {
                        console.log("Connection TimedOut, reconnecting...");
                        SUHAIL().catch(err => console.log(err));
                    } else if (reason === DisconnectReason.loggedOut) {
                        console.log("Logged out - this is expected after sending messages");
                    } else {
                        console.log('Connection closed with reason:', reason);
                    }
                }
            });

        } catch (err) {
            console.log("❌ Error in SUHAIL function:", err.message);
            console.log("Stack:", err.stack);
            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
            if (!res.headersSent) {
                await res.send({ code: "Try After Few Minutes" });
            }
        }
    }

    return await SUHAIL();
});

module.exports = router;
