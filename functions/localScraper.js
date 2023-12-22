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
        var runhour = 15;
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
                await reConnectToVpn(getVpnCountry());
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

async function fetchProductsToUpdate() {

    let moreProductsToFetch = true;
    let freshProducts = [];
    let tries = 0;
    while (moreProductsToFetch && tries < 20) {
        let { totalCount, products, error } = await VmpClient.FetchFreshProducts(freshProducts.length);

        freshProducts = freshProducts.concat(products);
        console.log(totalCount);
        console.info("freshProducts: " + freshProducts.length);

        if (!error && (
            totalCount === freshProducts.length
            || products.length === 0
            || freshProducts.length > 30000
        )) {
            moreProductsToFetch = false;
        } else if (error) {
            console.info("Could not fetch Products, waiting 1 second until retry");
            await new Promise(r => setTimeout(r, 35000));
        }
        tries++;
    }
    var idsToFilterOut = await FirebaseClient.GetProductIdsNotToBeUpdated();
    freshProducts = freshProducts.filter((id) => idsToFilterOut.indexOf(id) < 0);
    return freshProducts;
}

async function UpdatePrices() {
    var reconnectAttempted = false;
    var time = new Date();
    let productsToIgnore = await FirebaseClient.GetConstant("ProductsToIgnore");
    var ids = (await fetchProductsToUpdate()).filter((id) => productsToIgnore.indexOf(id) < 0).slice(0, time.getDate() <= 2 ? 25000 : 5000);
    var failcount = 0;
    for (let i = 0; i < ids.length; i++) {
        console.log("____________________");
        console.log("PriceFetch: " + i + " of " + ids.length);
        if (ids[i] !== undefined) {
            let response = await VmpClient.FetchProductPrice(ids[i]);
            if(response.product){
                await FirebaseClient.UpdateProductPrice(response.product);
            }
            let product = await VmpClient.GetProductDetails(ids[i]);
            if (product) {
                await FirebaseClient.SetProductStores(product.id, product.stores);
                failcount = 0;
                reconnectAttempted = false;
            }else{
                failcount++;
            }
        }

        if (failcount > 50) {
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
    productsToIgnore = [... new Set(productsToIgnore)];
    FirebaseClient.UpdateConstants(productsToIgnore, "ProductsToIgnore");
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