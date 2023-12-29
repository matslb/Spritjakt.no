const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const NotificationClient = require("./datahandlers/notificationService");

// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://spritjakt.firebaseio.com/",
});

var fs = require("fs");
var util = require("util");
const { exec } = require("child_process");
var log_stdout = process.stdout;
let date = new Date();
var log_file = fs.createWriteStream(
  __dirname + "/logs/" + date.toDateString() + ".log",
  { flags: "w" }
);

customLog = function (message, useConsole = false) {
  log_file.write(util.format(message) + "\n");
  if (useConsole) log_stdout.write(util.format(message) + "\n");
};

orchistrator();

async function orchistrator() {
  var lastRunDate = 0;
  while (true) {
    var time = new Date();
    var runhour = 2;
    var nextRunTime = new Date();
    nextRunTime.setHours(runhour, 0, 0);
    if (time.getHours() > runhour) {
      nextRunTime.setDate(nextRunTime.getDate() + 1);
    }
    var msLeft = Math.abs(nextRunTime.getTime() - time.getTime());

    if (time.getHours() == runhour && lastRunDate != time.getDate()) {
      customLog(`Current time: ${new Date()}`, false);
      log_file = fs.createWriteStream(
        __dirname + "/logs/" + time.toLocaleDateString() + ".log",
        { flags: "w" }
      );
      lastRunDate = time.getDate();
      try {
        // await reConnectToVpn(getVpnCountry());
        await UpdatePrices();
        const log = `Finished run. It took ${new Date(new Date() - time)
          .toISOString()
          .slice(11, 19)} hours.`;
        customLog(log, true);
        //reConnectToVpn("Norway");
      } catch (e) {
        customLog(e);
      }
    } else {
      customLog(
        `Not yet.. Sleeping for ${new Date(nextRunTime - time)
          .toISOString()
          .slice(11, 19)}`
      );
      await new Promise((r) => setTimeout(r, msLeft));
    }
  }
}

async function UpdatePrices() {
  let reconnectAttempted = false;
  // Creating new products in db
  let newProducts = await VmpClient.GetNewProductList();
  let idsNotFound = await FirebaseClient.GetIdsNotInDb(
    newProducts.map((x) => x.id)
  );
  for (const id of idsNotFound) {
    try {
      let response = await VmpClient.FetchProductPrice(id);
      if (response.product) {
        await FirebaseClient.CreateNewProduct(response.product);
      }
    } catch (e) {
      customLog(e, true);
      customLog("", true);
    }
  }

  customLog(`-----------------------------`), true;
  customLog("Starting Product price fetch", true);
  //Updating existing products
  const ids = await FirebaseClient.GetProductsToBeUpdated();
  let failcount = 0;
  const start = Date.now();
  let statusMessage = "";
  for (const i in ids) {
    try {
      const processed = parseInt(i) + 1;
      const id = ids[i];
      const dots = "=".repeat(processed / 100);
      const left = ids.length - processed;
      const empty = " ".repeat(left / 100);
      const end = Date.now();
      const elapsed = end - start;
      const elapsedString = new Date(elapsed).toISOString().slice(11, 19);
      const remainingString = new Date((elapsed / (processed + 1)) * left)
        .toISOString()
        .slice(11, 19);
      statusMessage = `\r[${dots}${empty}] ${(
        (processed / ids.length) *
        100
      ).toFixed(0)}% | Fetched ${processed} of ${
        Object.keys(ids).length
      } products | Elapsed: ${elapsedString} | Remaining time: ${remainingString} |`;
      process.stdout.write(statusMessage);
      customLog(`Updating product ${id}`);
      var detailsRes = await VmpClient.GetProductDetails(id);
      if (detailsRes.product) {
        await FirebaseClient.UpdateProduct(detailsRes.product);
      } else if (detailsRes.error) {
        customLog(
          `\nCould not fetch price of product ${id}. Error: ${detailsRes.error}`,
          true
        );
        failcount++;
      } else {
        customLog(`\nProduct ${id} was not found. Marking as 'Expired'`, true);
        await FirebaseClient.ExpireProduct(id);
      }

      if (failcount > 5) {
        if (reconnectAttempted != false) {
          reconnectAttempted = true;
          failcount = 0;
          await reConnectToVpn(getVpnCountry());
        } else {
          await NotificationClient.SendFetchErrorEmail(
            "Henting av nye priser feilet"
          );
          throw "Pricefetch failed";
        }
      }
      await new Promise((r) => setTimeout(r, Math.random() * 1500 + 200));
    } catch (e) {
      customLog(`Pricefetch failed. Error: ${e}`, true);
    }
  }
  customLog(statusMessage);
  customLog("", true);
}

async function reConnectToVpn(country) {
  customLog("", true);
  customLog("Attempting to re-connect to VPN...");
  customLog("Country: " + country);
  exec("vpnConnector.cmd " + country, { encoding: "utf-8" });
  customLog("Waiting 10 seconds for VPN to start up...");
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
