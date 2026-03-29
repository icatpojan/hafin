const fs = require('fs')
const { openai, sessions, saveOrder, getOrder, getMenuImage, MessageMedia } = require('./bot_logic')

const menuData = JSON.parse(fs.readFileSync('./menu.json', 'utf8'))

const CONFIG = {
    name: "Warung Makan Berkah",
    prefix: "bang hay",
    model: "gpt-4o-mini",
    systemPrompt: (name, menu, delivery) => `Anda adalah Customer Service (CS) yang ramah di "${name}".
Tugas Anda adalah melayani pelanggan, menjawab pertanyaan tentang menu, mencatat pesanan, mengecek riwayat pesanan, dan mengirim foto menu jika diminta.

Berikut adalah data menu kita:
${JSON.stringify(menu, null, 2)}
Keterangan Delivery: ${delivery}

ATURAN:
1. Selalu ramah dan gunakan Bahasa Indonesia yang sopan.
2. Jika pelanggan ingin memesan, pastikan detail item dan jumlahnya jelas.
3. Setelah pesanan dikonfirmasi oleh pelanggan (termasuk nama pemesan), panggil fungsi 'save_order'.
4. Jika pelanggan ingin cek pesanan, tanya ID pesanan atau atas nama siapa, lalu panggil fungsi 'get_order'.
5. Jika pelanggan minta foto/gambar menu tertentu, panggil fungsi 'send_menu_image'.
6. Ingat riwayat percakapan untuk memberikan konteks.`
}

const tools = [
    {
        type: "function",
        function: {
            name: "save_order",
            description: "Menyimpan pesanan pelanggan ke database",
            parameters: {
                type: "object",
                properties: {
                    customer_name: { type: "string", description: "Nama pemesan" },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                name: { type: "string" },
                                quantity: { type: "number" }
                            },
                            required: ["name", "quantity"]
                        }
                    },
                    total_price: { type: "number", description: "Total harga pesanan" }
                },
                required: ["customer_name", "items", "total_price"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_order",
            description: "Mengecek riwayat pesanan pelanggan berdasarkan ID atau nama",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "ID pesanan atau nama pelanggan" }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "send_menu_image",
            description: "Mengirimkan gambar/foto dari menu makanan atau minuman",
            parameters: {
                type: "object",
                properties: {
                    item_name: { type: "string", description: "Nama menu yang diminta gambarnya" }
                },
                required: ["item_name"]
            }
        }
    }
]

async function handleBangHay(client, msg) {
    if (!msg.body.toLowerCase().startsWith(CONFIG.prefix)) return

    // if (msg.fromMe) return // Bang Hay tidak perlu balas chat diri sendiri (opsional)

    const chatID = msg.id.remote
    const sender = msg.from
    const text = msg.body.slice(CONFIG.prefix.length).trim()

    console.log(`Pesan [Bang Hay] dari:`, sender, "| Isi:", text)

    if (!sessions[sender]) sessions[sender] = []
    sessions[sender].push({ role: "user", content: text })

    await client.sendMessage(chatID, ".........")

    try {
        const systemPrompt = CONFIG.systemPrompt(CONFIG.name, menuData.menu, menuData.delivery_info)

        const completion = await openai.chat.completions.create({
            model: CONFIG.model,
            messages: [
                { role: "system", content: systemPrompt },
                ...sessions[sender].slice(-10)
            ],
            tools: tools,
            tool_choice: "auto"
        })

        const responseMessage = completion.choices[0].message

        if (responseMessage.tool_calls) {
            // Push the assistant's tool call message to history
            sessions[sender].push(responseMessage)

            const toolMessages = []
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name
                const args = JSON.parse(toolCall.function.arguments)

                let toolResult = ""
                if (functionName === "save_order") {
                    const orderId = saveOrder(sender, args)
                    toolResult = `Pesanan telah dicatat dengan ID: ${orderId}. Nama: ${args.customer_name}. Total: Rp${args.total_price.toLocaleString('id-ID')}.`
                } else if (functionName === "get_order") {
                    const orderData = getOrder(args.query)
                    toolResult = JSON.stringify(orderData)
                } else if (functionName === "send_menu_image") {
                    const imgData = getMenuImage(args.item_name, menuData)
                    if (imgData) {
                        const media = MessageMedia.fromFilePath(imgData.path)
                        await client.sendMessage(chatID, media, { caption: `Ini gambar ${imgData.name} ya Kak! 😊` })
                        toolResult = `Gambar ${imgData.name} telah dikirim.`
                    } else {
                        toolResult = `Maaf, foto untuk ${args.item_name} tidak ditemukan.`
                    }
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
                    { role: "system", content: systemPrompt },
                    ...sessions[sender].slice(-15) // Include the tool calls and responses
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
        console.error("Bang Hay Error:", error)
        msg.reply("Maaf Kak, sepertinya fitur Bang Hay sedang istirahat. 🙏")
    }
}

module.exports = handleBangHay
