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

var fs = require('fs');
var util = require('util');
const { exec } = require("child_process");
const { selectClasses } = require("@mui/material");
var log_stdout = process.stdout;
let date = new Date();
var log_file = fs.createWriteStream(__dirname + '/logs/' + date.toDateString() + '.log', { flags: 'w' });

console.log = function (d) { //
    log_file.write(util.format(d) + '\n');
    log_stdout.write(util.format(d) + '\n');
};

orchistrator();

async function orchistrator() {
    var lastRunDate = 0;
    while (true) {
        var time = new Date();
        console.log("The time is " + time.getHours());
        var runhour = 18;
        var nextRunTime = new Date();
        nextRunTime.setHours(runhour, 0, 0);
        if (time.getHours() > runhour) {
            nextRunTime.setDate(nextRunTime.getDate() + 1);
        }
        var msLeft = Math.abs(nextRunTime.getTime() - time.getTime());
        var hoursLeft = Math.abs(nextRunTime.getTime() - time.getTime()) / 1000 / 60 / 60;

        if (time.getHours() == runhour && lastRunDate != time.getDate()) {
            lastRunDate = time.getDate();
            try {
                console.clear();
                log_file = fs.createWriteStream(__dirname + '/logs/' + time.toDateString() + '.log', { flags: 'w' });
                //await reConnectToVpn(getVpnCountry());
                await UpdatePrices();
                var stoppedTime = new Date();
                var runtime = (stoppedTime.getTime() - time.getTime()) / 1000 / 60 / 60;
                console.log("Finished run. It took " + runtime.toFixed(2) + " hours.");
                reConnectToVpn("Norway");
            } catch (e) {
                console.log(e);
            }
        } else {
            console.log("Not yet.. Sleeping for " + hoursLeft.toFixed(2) + " hours")
            await new Promise(r => setTimeout(r, msLeft));
        }
    }
}

async function UpdatePrices() {
    let reconnectAttempted = false;
    let  ids = [];
    
    for (let i = 0; i < 10; i++) {
        let newProducts = await VmpClient.GetNewProductList(i);
        let idsNotFound = await FirebaseClient.GetIdsNotInDb(newProducts.map(x => x.id));
        ids = ids.concat(idsNotFound);
    }
    ids = [ ... new Set(ids.concat(await FirebaseClient.GetProductsToBeUpdated()))];
    var failcount = 0;
    for (let i = 0; i < ids.length; i++) {
        console.log("____________________");
        console.log("PriceFetch: " + i + " of " + ids.length);
        if (ids[i] !== undefined) {
            let response = await VmpClient.FetchProductPrice(ids[i]);
            if(response.product){
                await FirebaseClient.UpdateProductPrice(response.product);
                await new Promise(r => setTimeout(r, 200));
                let detailsRes = await VmpClient.GetProductDetails(ids[i]);
                if (detailsRes.product) {
                    await FirebaseClient.SetProductStores(ids[i], detailsRes.product.stores);
                }else{
                    console.error("Could not fetch stock of product " + ids[i] + ": " + detailsRes.error);
                }
                failcount = 0;
                reconnectAttempted = false;
            }   
            else{
                console.error("Could not fetch price of product " + ids[i] + ": " + response.error);
                failcount++;
            }
        }

        if (failcount > 5) {
            if (reconnectAttempted != false) {
                reconnectAttempted = true;
                failcount = 0;
                await reConnectToVpn(getVpnCountry());
            } else {
                await NotificationClient.SendFetchErrorEmail("Henting av nye priser feilet");
                throw 'Pricefetch failed';
            }
        }
        console.log(new Date());

        await new Promise(r => setTimeout(r, (Math.random() * 1500) + 200));
    }
}

async function reConnectToVpn(country) {
    console.log("Attempting to re-connect to VPN...")
    console.log("Country: " + country);
    exec('vpnConnector.cmd ' + country, { encoding: 'utf-8' });
    console.log("Waiting 10 seconds for VPN to start up...")
    await new Promise(r => setTimeout(r, 10000));
}

function getVpnCountry() {
    let countries = ["Norway", "United States", "Germany", "Sweden", "Denmark", "France", "Spain", "Finland", "Poland"]
    return countries[Math.floor(Math.random() * (countries.length - 1))];
}