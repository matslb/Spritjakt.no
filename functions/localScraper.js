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
var log_file = fs.createWriteStream(__dirname + '/debug.log', { flags: 'w' });
var log_stdout = process.stdout;

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
        var runhour = 23;
        var nextRunTime = new Date();
        nextRunTime.setHours(runhour, 0, 0);
        if (time.getHours() > runhour) {
            nextRunTime.setDate(nextRunTime.getDate() + 1);
        }
        var msLeft = Math.abs(nextRunTime.getTime() - time.getTime());
        var hoursLeft = Math.abs(nextRunTime.getTime() - time.getTime()) / 1000 / 60 / 60;

        if (((msLeft <= 1000 * 60) || time.getHours() == runhour) && lastRunDate != time.getDate()) {
            lastRunDate = time.getDate();
            try {
                //  await UpdatePrices();
                await UpdateStocks();
                var stoppedTime = new Date();
                var runtime = (stoppedTime.getTime() - time.getTime()) / 1000 / 60 / 60;
                console.log("Finished run. It took " + runtime.toFixed(2) + " hours.");
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
            || freshProducts.length > 40000
        )) {
            moreProductsToFetch = false;
        } else if (error) {
            console.info("Could not fetch Products, waiting 1 second until retry");
            await new Promise(r => setTimeout(r, 1000));
        }
        tries++;
    }
    var idsToFilterOut = await FirebaseClient.GetProductIdsNotToBeUpdated();
    freshProducts = freshProducts.filter((id) => idsToFilterOut.indexOf(id) < 0).slice(0, 7500);

    return freshProducts;
}

async function UpdatePrices() {
    let productsToIgnore = await FirebaseClient.GetConstant("ProductsToIgnore");
    var ids = (await fetchProductsToUpdate()).filter((id) => productsToIgnore.indexOf(id) < 0);
    var failcount = 0;
    for (let i = 0; i < ids.length; i++) {
        console.log("PriceFetch: " + i + " of " + ids.length);
        if (ids[i] !== undefined) {
            let product = await VmpClient.FetchProductPrice(ids[i]);
            if (product !== null && product != false) {
                await FirebaseClient.UpdateProductPrice(product);
            }
            else if (product != false) {
                failcount++;
            } else {
                productsToIgnore.push(ids[i]);
                console.log("Ignoring " + ids[i] + " in future scrapes");
            }
        }
        if (failcount > 50) {
            await NotificationClient.SendFetchErrorEmail("Henting av nye priser feilet");
            throw 'Pricefetch failed';
        }
        console.log(new Date());
        await new Promise(r => setTimeout(r, Math.random() * 2000));
    }
    productsToIgnore = [... new Set(productsToIgnore)];
    FirebaseClient.UpdateConstants(productsToIgnore, "ProductsToIgnore");
}


async function UpdateStocks() {
    let ids = await FirebaseClient.GetProductIdsForStock();
    console.log("Updating " + ids.length + " stocks");

    let failcount = 0;
    let lastSuccessfullFetchId = null;
    const stores = await FirebaseClient.GetConstant("Stores");
    for (let i = 0; i < ids.length; i++) {
        console.log("---------------------");
        console.log("StockFetch: " + i + " of " + ids.length);
        console.log(ids[i]);
        if (ids[i] !== undefined) {
            let storeStock = await VmpClient.FetchStoreStock(ids[i], Object.assign([], stores));
            if (storeStock !== null) {
                let p = {
                    productId: ids[i],
                    Stores: storeStock
                }
                await FirebaseClient.UpdateProductStock(p);
                failcount = 0;
                lastSuccessfullFetchId = ids[i];
            }
            else {
                failcount++;
            }
            console.log(new Date());
            console.log("---------------------");
        }
        if (failcount >= 10) {
            console.log("Suspiciously many products with no stock. Attempting fetch of product known to be in stock (" + lastSuccessfullFetchId + ")...");
            let testStock = await VmpClient.FetchStoreStock(lastSuccessfullFetchId, stores);
            if (testStock == null) {
                console.log("The stock fetch endpoint does not work, something is fuckey. Sleeping for 5 minutes...");
                await new Promise(r => setTimeout(r, 1000 * 60 * 5));
            } else {
                console.log("Just a coincidence, keeping on truckin'");
                failcount = 0;
            }
        }
    }
}