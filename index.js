const puppeteer = require("puppeteer");
const axios = require("axios");
const config = require("./config.json");
const regions = require("./regions.json");
const fs = require("node:fs");
const { exit } = require("node:process");
const { log } = require("node:console");

async function fetchPage(region) {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto(
    `https://www.trenitalia.com/it/treni_regionali/${region}/lavori_e_modifichealservizio.html`
  );

  const info = await page.evaluate(() => {
    return backedItemsList;
  });
  await browser.close();
  return info;
}

async function sendTelegramMessage(chatId, message, botToken) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const params = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    };

    await axios.post(url, params);
  } catch (error) {
    console.error("Errore durante l'invio del messaggio:", error.message);
  }
}

async function sendUpdatesToTelegram(data, channelId) {
  for (const element of data) {
    let message;
    message = `<b>${element["titolo"]}</b>\n`;
    message += `<i>In vigore dal: ${element["dataI"]} al: ${element["dataF"]}</i>\n\n`;
    if (element["allegato"]) {
      message += `🧭 Per viabilità clicca <a href="www.trenitalia.com${element["allegato"]}">QUI</a>\n`;
    }
    if (element["ciLink"]) {
      message += `ℹ️ Per maggiori informazioni clicca <a href="www.trenitalia.com${element["ciLink"]}">QUI</a>`;
    }
    sendTelegramMessage(channelId, message, config["bot_token"]);
    await new Promise((resolve) => setTimeout(resolve, 7000));
  }
}

async function main() {
  for (const [regionName, region] of Object.entries(regions)) {
    if (region.channelId) {
      //Not all regions implemented yet, so use only region with channelId

      let newData = await fetchPage(regionName);
      let lastData;

      fs.readFile(region.filePath, "utf8", (error, data) => {
        if (error) {
          console.log(error);
          return;
        }
        lastData = JSON.parse(data); // Parsa il JSON letto dal file
        // Esegui il confronto solo dopo aver letto il file
        if (JSON.stringify(newData) !== JSON.stringify(lastData)) {
          fs.writeFile(region.filePath, JSON.stringify(newData), (error) => {
            if (error) {
              console.log("Error Write File ", error);
              return;
            }
            console.log("Data written successfully to disk");
            sendUpdatesToTelegram(newData, region.channelId);
          });
        }
      });
    }
  }
}

main();
