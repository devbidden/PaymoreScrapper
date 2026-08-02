require("dotenv").config();

const cron = require("node-cron");
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const { sendTelegramMessage } = require("./notifier/telegram");

const outputPath = path.join(__dirname, "database", "listing.json");

function cleanText(value) {
    if (!value) {
        return "";
    }

    return String(value).replace(/\s+/g, " ").trim();
}

function parseListingText(text) {
    const cleaned = cleanText(text);
    const parts = cleaned.split(/PayMore|\$|Device Only|Good|Fair|Excellent|Condition:/i);

    const title = parts[0] ? cleanText(parts[0]) : cleaned;
    const locationMatch = cleaned.match(/PayMore\s+([A-Za-z .,-]+)/i);
    const location = locationMatch ? cleanText(locationMatch[1]) : "Unknown";

    const priceMatch = cleaned.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
    const price = priceMatch ? `$${priceMatch[1]}` : "Unknown";

    const conditionMatch = cleaned.match(/\b(Good|Fair|Flawless|Excellent)\b/i);
    const condition = conditionMatch ? conditionMatch[1] : "Unknown";

    const extraComments = cleaned.includes("Device Only") ? "Device Only" : "No extra comments";

    return {
        title,
        location,
        price,
        condition,
        extraComments,
    };
}

async function scrapeListings() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    await page.setViewportSize({ width: 1440, height: 1600 });
    await page.goto("https://paymore.com/shop/category/apple-iphones/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });

    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => { });
    await page.waitForTimeout(3000);

    const productLinks = await page.locator("a[href*='/shop/product/']").evaluateAll((elements) =>
        elements.map((el) => ({
            text: el.textContent || "",
            href: el.getAttribute("href") || "",
        }))
    );

    const uniqueProducts = productLinks
        .map((item) => ({
            text: cleanText(item.text),
            href: item.href,
        }))
        .filter((item) => item.text)
        .filter((item, index, array) => array.findIndex((entry) => entry.text === item.text) === index);

    const data = uniqueProducts.slice(0, 20).map((product, index) => ({
        id: index + 1,
        title: product.text,
        url: product.href.startsWith("http") ? product.href : `https://paymore.com${product.href}`,
        ...parseListingText(product.text),
    }));

    await browser.close();
    return data;
}

function loadSavedListings() {
    if (!fs.existsSync(outputPath)) {
        return [];
    }

    const raw = fs.readFileSync(outputPath, "utf8").trim();
    if (!raw) {
        return [];
    }

    try {
        const saved = JSON.parse(raw);
        return Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error("Could not read saved listings:", error.message);
        return [];
    }
}

function getNewListings(currentListings, previousListings) {
    const previousTitles = new Set(previousListings.map((item) => item.title.toLowerCase()));
    return currentListings.filter((item) => !previousTitles.has(item.title.toLowerCase()));
}

async function runJob() {
    try {
        const previousListings = loadSavedListings();
        const currentListings = await scrapeListings();
        const newListings = getNewListings(currentListings, previousListings);

        fs.writeFileSync(outputPath, JSON.stringify(currentListings, null, 2));

        if (newListings.length > 0) {
            for (const listing of newListings) {
                const message = [
                    "📱 New PayMore Listing",
                    `\n📝 Title: ${listing.title || "N/A"}`,
                    `📍 Location: ${listing.location || "N/A"}`,
                    `💵 Price: ${listing.price || "N/A"}`,
                    `🧾 Condition: ${listing.condition || "N/A"}`,
                    `💬 Extra comments: ${listing.extraComments || "N/A"}`,
                    `🔗 URL: ${listing.url || "N/A"}`,
                ].join("\n");

                await sendTelegramMessage(message);
                console.log(`Sent: ${listing.title}`);
            }

            console.log(`Sent ${newListings.length} new listing(s) to Telegram.`);
        } else {
            console.log("No new listings found. Skipping Telegram message.");
            await sendTelegramMessage(`No new listings found at ${new Date().toLocaleString()}.`);
        }
    } catch (error) {
        console.error("Scheduler error:", error.message);
        if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
            await sendTelegramMessage(`PayMore scraper failed: ${error.message}`);
        }
    }
}

console.log("Running initial scrape...");
    scrapeListings();

cron.schedule("*/1 * * * *", () => {
    runJob();
});

console.log("Scheduler started. Scraping every 1 minutes.");

module.exports = { runJob, scrapeListings };