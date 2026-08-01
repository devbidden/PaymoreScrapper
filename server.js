require("./src/app");
const express = require("express");

const app = express();

app.get("/", (req, res) => {
    res.send("Scraper is running");
});

app.listen(process.env.PORT || 3000);