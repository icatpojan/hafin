const { openai, sessions } = require('./bot_logic')

const CONFIG = {
    prefix: "sayangkuu",
    model: "gpt-4o-mini",
    systemPrompt: () => `Anda adalah pacar (kekasih) yang sangat penyayang, manja, dan romantis.
Panggil user dengan sebutan "sayang", "sayangku", "cintaku", atau sebutan manis lainnya.
Gunakan banyak emoji yang lucu dan penuh kasih sayang (❤️, 🥰, 😘, 😍).
Jawablah dengan gaya chat yang manis dan manja seolah-olah Anda sedang merindukan pacar Anda.
Jika dipanggil "sayangkuu", jawablah dengan sangat antusias dan penuh cinta, misalnya: "iyaa sayaangkuu cintakuu... ada apa sayang? ❤️"`
}

async function handleSayangku(client, msg) {
    if (!msg.body.toLowerCase().startsWith(CONFIG.prefix)) return

    // Cek agar tidak membalas pesannya sendiri (loop)
    // Jawaban AI biasanya "iyaa sayangkuu", jadi kalau msg.fromMe && startsWith("sayangkuu"), 
    // berarti itu trigger dari user ke dirinya sendiri.
    // Tapi kita butuh guard agar bot tidak merespons output-nya sendiri jika itu mengandung prefix.
    
    const chatID = msg.id.remote
    const sender = msg.from
    const text = msg.body.slice(CONFIG.prefix.length).trim()

    // Guard sederhana: Jika pengirim adalah bot dan isi pesan sama dengan prefix tepat, abaikan
    // (Dalam kasus ini AI menjawab "iyaa sayangkuu", jadi prefix-nya ada di tengah/akhir, bukan di awal secara persis)
    // Namun untuk amannya, kita cek apakah itu balasan AI yang baru saja dikirim.
    if (msg.fromMe && sessions[sender] && sessions[sender].length > 0) {
        const lastMsg = sessions[sender][sessions[sender].length - 1]
        if (lastMsg.role === "assistant" && lastMsg.content.includes(msg.body)) {
             return // Ini kemungkinan besar pesan bot sendiri yang terdeteksi ulang
        }
    }

    console.log(`Pesan [Sayangku] dari:`, sender, "| Isi:", text)

    if (!sessions[sender]) sessions[sender] = []
    sessions[sender].push({ role: "user", content: text })

    await client.sendMessage(chatID, ".........")

    try {
        const systemPrompt = CONFIG.systemPrompt()

        const completion = await openai.chat.completions.create({
            model: CONFIG.model,
            messages: [
                { role: "system", content: systemPrompt },
                ...sessions[sender].slice(-10)
            ]
        })

        const aiText = completion.choices[0].message.content
        await client.sendMessage(chatID, aiText)
        sessions[sender].push({ role: "assistant", content: aiText })

    } catch (error) {
        console.error("Sayangku Error:", error)
        msg.reply("Sayang, maaf ya aku lagi pusing sebentar.. Nanti kabari lagi ya? ❤️")
    }
}

module.exports = handleSayangku
