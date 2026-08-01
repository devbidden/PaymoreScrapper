const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

function cleanText(value) {
    if (!value) {
        return "";
    }

    return String(value).replace(/\s+/g, " ").trim();
}

(async () => {
    const browser = await chromium.launch({
        headless: true,
    });

    const page = await browser.newPage();

    await page.setViewportSize({ width: 1440, height: 1600 });

    await page.goto("https://paymore.com/shop/category/apple-iphones/", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });

    await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => { });

    await page.waitForTimeout(3000);

    const titles = await page.locator("a[href*='/shop/product/']").evaluateAll((elements) =>
        elements.map((el) => el.textContent || "")
    );

    const uniqueTitles = titles
        .map((text) => cleanText(text))
        .filter(Boolean)
        .filter((text, index, array) => array.indexOf(text) === index);

    const outputPath = path.join(__dirname, "..", "database", "listing.json");
    const data = uniqueTitles.slice(0, 50).map((title, index) => ({
        id: index + 1,
        title,
    }));

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));

    console.log(`Found ${uniqueTitles.length} product entries`);
    console.log(`Saved ${data.length} entries to ${outputPath}`);
    data.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
    });

    await browser.close();
})();