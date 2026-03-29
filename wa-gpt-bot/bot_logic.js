const OpenAI = require('openai')
const fs = require('fs')
const { MessageMedia } = require('whatsapp-web.js')

require('dotenv').config()

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

const sessions = {}

function saveOrder(sender, orderDetails) {
    const ordersPath = './orders.json'
    const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'))

    const newOrder = {
        id: `ORD-${Date.now()}`,
        customer: sender,
        customer_name: orderDetails.customer_name || "Pelanggan",
        items: orderDetails.items,
        total: orderDetails.total_price,
        status: "Pending",
        timestamp: new Date().toISOString()
    }

    orders.push(newOrder)
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2))
    return newOrder.id
}

function getOrder(query) {
    if (!query) return "Mohon berikan ID pesanan atau nama pelanggan."

    const ordersPath = './orders.json'
    const orders = JSON.parse(fs.readFileSync(ordersPath, 'utf8'))

    const lowerQuery = query.toLowerCase()
    const result = orders.filter(o =>
        (o.id && o.id.toLowerCase() === lowerQuery) ||
        (o.customer_name && o.customer_name.toLowerCase().includes(lowerQuery)) ||
        (o.customer && o.customer.includes(query))
    )

    return result.length > 0 ? result : "Pesanan tidak ditemukan."
}

function getMenuImage(itemName, menuData) {
    if (!itemName) return null
    const item = menuData.menu.find(m => m.name.toLowerCase().includes(itemName.toLowerCase()))
    if (item && item.image_path && fs.existsSync(item.image_path)) {
        return {
            path: item.image_path,
            name: item.name
        }
    }
    return null
}

function saveComplaint(developer, complaintData) {
    const fileName = `./complaints_${developer.toLowerCase()}.json`
    let complaints = []
    
    if (fs.existsSync(fileName)) {
        complaints = JSON.parse(fs.readFileSync(fileName, 'utf8'))
    }

    const newComplaint = {
        id: `CMPL-${Date.now()}`,
        sender: complaintData.sender,
        reporter_name: complaintData.reporter_name || "Anonim",
        feature: complaintData.feature,
        detail: complaintData.detail,
        status: "Pending",
        timestamp: new Date().toISOString()
    }

    complaints.push(newComplaint)
    fs.writeFileSync(fileName, JSON.stringify(complaints, null, 2))
    return newComplaint.id
}

function getComplaintStatus(query) {
    const files = fs.readdirSync('./').filter(f => f.startsWith('complaints_') && f.endsWith('.json'))
    let foundComplaints = []

    for (const file of files) {
        const content = JSON.parse(fs.readFileSync(`./${file}`, 'utf8'))
        const filtered = content.filter(c => 
            c.id.toLowerCase().includes(query.toLowerCase()) || 
            (c.reporter_name && c.reporter_name.toLowerCase().includes(query.toLowerCase()))
        )
        if (filtered.length > 0) {
            foundComplaints = foundComplaints.concat(filtered)
        }
    }

    return foundComplaints.length > 0 ? foundComplaints : "Keluhan tidak ditemukan."
}

module.exports = {
    openai,
    sessions,
    saveOrder,
    getOrder,
    getMenuImage,
    saveComplaint,
    getComplaintStatus,
    MessageMedia
}
