const { exec } = require("child_process");
const uploadToPastebin = require('./Paste');  // Make sure the function is correctly imported
const express = require('express');
let router = express.Router();
const pino = require("pino");

let { toBuffer } = require("qrcode");
const path = require('path');
const fs = require("fs-extra");
const { Boom } = require("@hapi/boom");

const MESSAGE = process.env.MESSAGE || `
*Session id generated for EF-PRIME-MD V2*

> Thank you for choosing EF-PRIME-MD V2`;

if (fs.existsSync('./auth_info_baileys')) {
  fs.emptyDirSync(__dirname + '/auth_info_baileys');
}

router.get('/', async (req, res) => {
  const { default: SuhailWASocket, useMultiFileAuthState, Browsers, delay, DisconnectReason, makeInMemoryStore } = require("@whiskeysockets/baileys");
  const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });

  async function SUHAIL() {
    const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys');

    try {
      let Smd = SuhailWASocket({
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: Browsers.macOS("Desktop"),
        auth: state
      });

      Smd.ev.on("connection.update", async (s) => {
        const { connection, lastDisconnect, qr } = s;

        if (qr) {
          // Ensure the response is only sent once
          if (!res.headersSent) {
            res.setHeader('Content-Type', 'image/png');
            try {
              const qrBuffer = (await toBuffer(qr));  // Convert QR to buffer
              res.end(qrBuffer);  // Send the buffer as the response
              return; // Exit the function to avoid sending further responses
            } catch (error) {
              console.error("Error generating QR Code buffer:", error);
              return; // Exit after sending the error response
            }
          }
        }

        if (connection === "open") {
          await delay(3000);
          let user = Smd.user.id;

          //===========================================================================================
          //===============================  SESSION ID    ===========================================
          //===========================================================================================

          const auth_path = './auth_info_baileys/';
          const credsFilePath = auth_path + 'creds.json';

          // Upload the creds.json file to Pastebin directly
          const pastebinUrl = await uploadToPastebin(credsFilePath, 'creds.json', 'json', '1');
          
          const Scan_Id = pastebinUrl;  // Use the returned Pastebin URL directly

          console.log(`
====================  SESSION ID  ==========================
SESSION-ID ==> ${Scan_Id}
-------------------   SESSION CLOSED   -----------------------
`);

          let msgsss = await Smd.sendMessage(user, { text: Scan_Id });
          await Smd.sendMessage(user, { text: MESSAGE }, { quoted: msgsss });
          await delay(1000);

          try {
            await fs.emptyDirSync(__dirname + '/auth_info_baileys');
          } catch (e) {
            console.error('Error clearing directory:', e);
          }
        }

        Smd.ev.on('creds.update', saveCreds);

        if (connection === "close") {
          let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
          // Handle disconnection reasons
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
            process.exit(0);
          }
        }
      });

    } catch (err) {
      console.log(err);
      exec('pm2 restart qasim');
      await fs.emptyDirSync(__dirname + '/auth_info_baileys');
    }
  }

  SUHAIL().catch(async (err) => {
    console.log(err);
    await fs.emptyDirSync(__dirname + '/auth_info_baileys');
    exec('pm2 restart qasim');
  });

  return await SUHAIL();
});

module.exports = router;
