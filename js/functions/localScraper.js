const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const serviceAccount = require("./configs/serviceAccountKey.json");
const NotificationClient = require("./datahandlers/notificationService");
const firebase = require("firebase-admin");
require("firebase/firestore");

// Initialize the app with a service account, granting admin privileges
firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: "https://spritjakt.firebaseio.com/",
});

var fs = require("fs");
var util = require("util");
const { exec } = require("child_process");
const { Console } = require("console");
var log_stdout = process.stdout;
let date = new Date();
var log_file;
const log_File_name = () =>
  __dirname + "/logs/" + date.toISOString().slice(0, 10) + ".log";

customLog = function (message, useConsole = false) {
  log_file.write(util.format(message) + "\n");
  if (useConsole) log_stdout.write(util.format(message) + "\n");
};

orchistrator();

async function orchistrator() {
  var lastRunDate = -1;
  while (true) {
    var time = new Date();
    var runhour =
      process.argv.length > 2 ? process.argv.slice(2) : time.getHours();
    var nextRunTime = new Date();

    nextRunTime.setHours(runhour, 0, 0);
    if (time.getHours() > runhour || lastRunDate == nextRunTime.getDate()) {
      nextRunTime.setDate(nextRunTime.getDate() + 1);
    }
    var msLeft = Math.abs(nextRunTime.getTime() - time.getTime());

    if (time.getHours() == runhour && lastRunDate != time.getDate()) {
      lastRunDate = time.getDate();
      log_file = fs.createWriteStream(log_File_name(), { flags: "w" });
      customLog(`Current time: ${new Date()}`, false);
      await reConnectToVpn(getVpnCountry());
      await UpdatePrices();
      customLog(
        `Finished run. It took ${new Date(new Date() - time)
          .toISOString()
          .slice(11, 19)} hours.`,
        true
      );
      reConnectToVpn("Norway");
    } else {
      log_stdout.write(
        `Not yet.. Sleeping for ${new Date(nextRunTime - time)
          .toISOString()
          .slice(11, 19)}\n`
      );
      await new Promise((r) => setTimeout(r, msLeft));
    }
  }
}

async function UpdatePrices() {
  customLog("Fetching new products:", true);
  let reconnectAttempted = false;
  // Creating new products in db

  let newProducts = await VmpClient.GetNewProductList();
  let newProductIds = newProducts.map((p) => p.Id);

  if (newProductIds.length > 0) {
    customLog(`Checking if ${newProductIds.length} products not in db`, true);
    let idsNotFound = await FirebaseClient.GetIdsNotInDb(newProductIds);
    customLog(
      `${idsNotFound.length} new products found. Creating them in database`,
      true
    );
    for (const id of idsNotFound) {
      process.stdout.write(
        `\r${idsNotFound.indexOf(id)} of ${idsNotFound.length} Created`
      );
      try {
        let response = await VmpClient.GetProductDetailsWithStock(id, true);
        if (response.product) {
          await FirebaseClient.UpsertProduct(response.product);
        }
        await new Promise((r) => setTimeout(r, Math.random() * 500));
      } catch (e) {
        customLog(e, true);
      }
    }
  }

  customLog("Starting Product price fetch", true);
  //Updating existing products
  const products = await FirebaseClient.GetProductsToBeUpdated();
  const p_batches = chunk(products, 100);
  let failcount = 0;
  const start = Date.now();
  let statusMessage = "";
  const progressbarWidth = 35;

  for (const batch of p_batches) {
    var db_batch = firebase.firestore().batch();

    for (const product of batch) {
      console.clear();
      const processed = products.indexOf(product) + 1;
      const percentage = processed / products.length;
      const filled = progressbarWidth * percentage;
      const empty = progressbarWidth - filled;
      const left = products.length - processed;
      const end = Date.now();
      const elapsed = end - start;
      const elapsedString = new Date(elapsed).toISOString().slice(11, 19);
      const remainingString = new Date((elapsed / (processed + 1)) * left)
        .toISOString()
        .slice(11, 19);
      statusMessage = `\r[${"=".repeat(filled)}${".".repeat(empty)}] ${(
        percentage * 100
      ).toFixed(0)}% | Fetched ${processed} of ${
        products.length
      } products | Elapsed: ${elapsedString} | Remaining time: ${remainingString} `;
      process.stdout.write(statusMessage);
      try {
        var detailsRes = await VmpClient.GetProductDetailsWithStock(
          product.Id,
          product.Ingredients == undefined || product.LiterPriceAlcohol == NaN
        );

        if (detailsRes.product) {
          var found = await FirebaseClient.UpdateProduct(
            db_batch,
            product,
            detailsRes.product
          );
          if (found == false) {
            customLog(`Could not update Product ${product.Id}`);
          }
          reconnectAttempted = false;
        } else if (detailsRes.error) {
          customLog(
            `Could not fetch price of product ${product.Id}. Error: ${detailsRes.error}`
          );
          failcount++;
        } else {
          customLog(
            `Product ${product.Id} was not found. Marking as 'Expired'`
          );
          await FirebaseClient.ExpireProduct(db_batch, product.Id);
        }

        if (failcount > 3) {
          if (reconnectAttempted === false) {
            reconnectAttempted = true;
            customLog(
              `${failcount} products failed in a row. Attempting to re-connect`
            );
            failcount = 0;
            await reConnectToVpn(getVpnCountry());
          } else {
            await NotificationClient.SendFetchErrorEmail(
              "Henting av nye priser feilet"
            );
            customLog("Pricefetch failed", true);
            return;
          }
        }
        await new Promise((r) => setTimeout(r, Math.random() * 500));
      } catch (e) {
        customLog(`Pricefetch failed. Error: ${e}`, true);
      }
    }
    await db_batch.commit();
  }
  customLog(statusMessage);
  customLog("", true);
}

async function reConnectToVpn(country) {
  customLog("", true);
  customLog("Attempting to re-connect to VPN...");
  customLog("Country: " + country);
  exec("vpnConnector.cmd " + country, { encoding: "utf-8" });
  customLog("Waiting 10 seconds for VPN to start up...", true);
  await new Promise((r) => setTimeout(r, 10000));
}

function getVpnCountry() {
  let countries = [
    "Norway",
    "United States",
    "Germany",
    "Sweden",
    "Denmark",
    "France",
    "Spain",
    "Finland",
    "Poland",
  ];
  return countries[Math.floor(Math.random() * (countries.length - 1))];
}
const chunk = (arr, size) =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );
