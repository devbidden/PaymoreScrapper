const axios = require("axios");

async function sendTelegramMessage(text) {
    const token = (process.env.TELEGRAM_BOT_TOKEN || "")
        .replace(/^['"]|['"]$/g, "")
        .replace(/;$/, "")
        .trim();
    const chatId = (process.env.TELEGRAM_CHAT_ID || "")
        .replace(/^['"]|['"]$/g, "")
        .replace(/;$/, "")
        .trim();

    if (!token || !chatId) {
        throw new Error("Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your environment.");
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const response = await axios.post(url, {
            chat_id: chatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true,
        });

        return response.data;
    } catch (error) {
        const details = error.response?.data || error.message;
        console.error("Telegram send failed:", JSON.stringify(details, null, 2));
        throw new Error(`Request failed with status code ${error.response?.status || "unknown"}`);
    }
}

module.exports = {
    sendTelegramMessage,
};
