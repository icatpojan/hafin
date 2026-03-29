const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const handleBangHay = require('./bot_banghay')
const handleSayangku = require('./bot_sayangku')
const handleJidHelpdesk = require('./bot_jidhelpdesk')

/* =========================
   WHATSAPP CLIENT SETUP
========================= */

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage'
        ]
    }
})

client.on('qr', qr => {
    console.log("Scan QR ini di WhatsApp")
    qrcode.generate(qr, { small: true })
})

client.on('ready', () => {
    console.log("WhatsApp Bot Ready 🚀")
})

/* =========================
   MESSAGE HANDLER (CENTRAL)
========================= */

// Menggunakan message_create agar menangkap pesan masuk & pesan dari diri sendiri
client.on('message_create', async msg => {
    // Jalankan logika masing-masing bot secara paralel
    Promise.all([
        handleBangHay(client, msg),
        handleSayangku(client, msg),
        handleJidHelpdesk(client, msg)
    ]).catch(err => console.error("Global Error:", err))
})

// Hapus listener 'message' yang lama agar tidak double reply
// client.on('message', ...) sudah tidak ada di sini

/* =========================
   START BOT
======================== */

client.initialize()