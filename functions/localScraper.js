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
orchistrator();

async function orchistrator() {
    var lastRunDate = 0;
    while (true) {
        var time = new Date();
        console.log("The time is " + time.getHours());

        if (time.getHours() == 8 && lastRunDate != time.getDate()) {
            lastRunDate = time.getDate();
            await UpdatePrices();
            await UpdateStocks();
            console.log("Finished update. Sleeping for 24 hours.")
        } else {
            console.log("Not yet.. Continuing sleep...")
        }
        await new Promise(r => setTimeout(r, 1000 * 60 * 60));
    }
}

async function fetchProductsToUpdate() {

    let moreProductsToFetch = true;
    let freshProducts = [];
    let tries = 0;
    let date = new Date();
    let dayofMonth = date.getDate();
    while (moreProductsToFetch && tries < 20) {
        let { totalCount, products, error } = await VmpClient.FetchFreshProducts(freshProducts.length);

        freshProducts = freshProducts.concat(products);
        console.log(totalCount);
        console.info("freshProducts: " + freshProducts.length);

        if (!error && (
            totalCount === freshProducts.length
            || products.length === 0
            || freshProducts.length > 35000
        )) {
            moreProductsToFetch = false;
        } else if (error) {
            console.info("Could not fetch Products, waiting 1 second until retry");
            await new Promise(r => setTimeout(r, 1000));
        }
        tries++;
    }
    var idsToFilterOut = await FirebaseClient.GetProductIdsNotToBeUpdated();
    freshProducts = freshProducts.filter((id) => idsToFilterOut.indexOf(id) < 0);

    return freshProducts;
}

async function UpdatePrices() {
    var ids = await fetchProductsToUpdate();
    var failcount = 0;
    for (let i = 0; i < ids.length; i++) {
        if (ids[i] !== undefined) {
            let product = await VmpClient.FetchProductPrice(ids[i]);
            if (product !== null && product != false) {
                await FirebaseClient.UpdateProductPrice(product);
            }
            else if (product != false) {
                failcount++;
            }
        }
        if (failcount > 50) {
            await NotificationClient.SendFetchErrorEmail("Henting av nye priser feilet");
        }
        await new Promise(r => setTimeout(r, Math.random() * 2000));
    }
}


async function UpdateStocks() {
    let ids = await FirebaseClient.GetProductIdsForStock();
    let d = new Date();

    d.setDate(d.getDate() - 2);
    d.setHours(0);

    let onSaleIds = await FirebaseClient.GetProductsOnSale(d.getTime());

    if (onSaleIds && onSaleIds.length > 0)
        ids = [...new Set(onSaleIds.concat(ids))];

    console.log("Updating " + ids.length + " stocks");

    var failcount = 0;
    let stores = await FirebaseClient.GetConstant("Stores");
    for (let i = 0; i < ids.length; i++) {
        if (ids[i] !== undefined) {
            let storeStock = await VmpClient.FetchStoreStock(ids[i], stores);
            if (storeStock !== null) {
                let p = {
                    productId: ids[i],
                    Stores: storeStock
                }
                await FirebaseClient.UpdateProductStock(p);
            }
            else {
                failcount++;
            }
        }
        if (failcount > 50) {
            await NotificationClient.SendFetchErrorEmail("Henting av lagerstatus feilet");
        }
        await new Promise(r => setTimeout(r, Math.random() * 2000));
    }
}