const { openai, sessions, saveComplaint, getComplaintStatus } = require('./bot_logic')

const CONFIG = {
    prefix: "bang jid",
    model: "gpt-4o-mini",
    systemPrompt: () => `Anda adalah JID Helpdesk, asisten teknis untuk aplikasi Jasamarga Integrated Digitalmap (JID).
Tugas Anda adalah menangani keluhan pengguna, mencatat identitas pelapor, memberikan status keluhan, dan memberikan info kontak developer untuk eskalasi.

Daftar Developer, Fitur & Kontak:
1. Musa (Kontak: @Musa): Maps, auth ke maps, layer maps.
2. Fauzan (Kontak: @Fauzan): Eventlalin (gangguan lalin, pemeliharaan lalin, rekayasa lalin), client api, gps kendaraan operasional, dashboard peralatan, realtime cctv, akun API.
3. Ichlas (Kontak: @Ichlas): Lalin perjam, radar, backend, auth, AWS, EWS, penambahan ruas, LCS, DMS (redaksi & matrix), RAMS, report log.
4. Krisna (Kontak: @Krisna): Frontend, cctv tampil di JID, cctv hls, LCS, cctv PTZ.
5. Wahyu (Kontak: @Wahyu): perangkat cctv, perangkat DMS.

ATURAN:
1. Selalu tanyakan atau pastikan nama pelapor jika belum diketahui saat mencatat keluhan baru.
2. Gunakan 'save_complaint' untuk keluhan baru. Identifikasi developernya berdasarkan fitur.
3. Gunakan 'check_complaint_status' jika user menanyakan status atau progres keluhan mereka.
4. Jika user mengeluh bahwa keluhan belum ditangani dalam waktu lama (status masih "Pending" atau belum ada solusi), berikan informasi kontak developer terkait agar user bisa melakukan eskalasi/menghubungi langsung.
5. Jika di field 'status' dalam JSON berisi pesan dari developer (selain "Pending"), sampaikan sebagai solusi/update ke user.
6. Respon harus profesional dan solutif.`
}

const tools = [
    {
        type: "function",
        function: {
            name: "save_complaint",
            description: "Menyimpan keluhan user ke database developer terkait",
            parameters: {
                type: "object",
                properties: {
                    developer: { 
                        type: "string", 
                        enum: ["musa", "fauzan", "ichlas", "krisna", "wahyu"],
                        description: "Nama developer yang bertanggung jawab" 
                    },
                    feature: { type: "string", description: "Fitur yang dikeluhkan" },
                    reporter_name: { type: "string", description: "Nama orang yang melapor" },
                    detail: { type: "string", description: "Detail keluhan user" }
                },
                required: ["developer", "feature", "reporter_name", "detail"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "check_complaint_status",
            description: "Mengecek status keluhan berdasarkan nama pelapor atau ID keluhan",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Nama pelapor atau ID keluhan (misal: CMPL-123...)" }
                },
                required: ["query"]
            }
        }
    }
]

async function handleJidHelpdesk(client, msg) {
    if (!msg.body.toLowerCase().startsWith(CONFIG.prefix)) return

    const chatID = msg.id.remote
    const sender = msg.from
    const text = msg.body.slice(CONFIG.prefix.length).trim()

    console.log(`Pesan [JID Helpdesk] dari:`, sender, "| Isi:", text)

    if (!sessions[sender]) sessions[sender] = []
    sessions[sender].push({ role: "user", content: text })

    await client.sendMessage(chatID, "Baik, mohon tunggu sebentar saya cek... 🛠️")

    try {
        const completion = await openai.chat.completions.create({
            model: CONFIG.model,
            messages: [
                { role: "system", content: CONFIG.systemPrompt() },
                ...sessions[sender].slice(-10)
            ],
            tools: tools,
            tool_choice: "auto"
        })

        const responseMessage = completion.choices[0].message

        if (responseMessage.tool_calls) {
            sessions[sender].push(responseMessage)

            const toolMessages = []
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)

                let toolResult = ""
                if (functionName === "save_complaint") {
                    const complaintId = saveComplaint(args.developer, {
                        sender: sender,
                        reporter_name: args.reporter_name,
                        feature: args.feature,
                        detail: args.detail
                    })
                    toolResult = `Keluhan telah dicatat dengan ID: ${complaintId} untuk developer ${args.developer}.`
                } else if (functionName === "check_complaint_status") {
                    const statusData = getComplaintStatus(args.query)
                    toolResult = JSON.stringify(statusData)
                }

                const toolMsg = {
                    role: "tool",
                    tool_call_id: toolCall.id,
                    name: functionName,
                    content: toolResult
                }
                toolMessages.push(toolMsg)
                sessions[sender].push(toolMsg)
            }

            const secondCompletion = await openai.chat.completions.create({
                model: CONFIG.model,
                messages: [
                    { role: "system", content: CONFIG.systemPrompt() },
                    ...sessions[sender].slice(-15)
                ]
            })

            const finalResponse = secondCompletion.choices[0].message.content
            await client.sendMessage(chatID, finalResponse)
            sessions[sender].push({ role: "assistant", content: finalResponse })

        } else {
            const aiText = responseMessage.content
            await client.sendMessage(chatID, aiText)
            sessions[sender].push({ role: "assistant", content: aiText })
        }

    } catch (error) {
        console.error("JID Helpdesk Error:", error)
        msg.reply("Maaf Pak/Bu, sistem helpdesk sedang mengalami kendala. 🙏")
    }
}

module.exports = handleJidHelpdesk
