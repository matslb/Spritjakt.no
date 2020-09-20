const functions = require("firebase-functions");
const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const EmailClient = require("./datahandlers/emailClient");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const rp = require("request-promise");
const SortArray = require("sort-array");

const allTimeEarliestDate = new Date(1594166400000);

// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://spritjakt.firebaseio.com/",
});


async function testSync() {

    let moreProductsToFetch = true;
    let freshProducts = [];
    let tries = 0;
    while (moreProductsToFetch && tries < 20) {
        let { totalCount, products, error } = await VmpClient.FetchFreshProducts(freshProducts.length);

        freshProducts = freshProducts.concat(products);
        console.log(totalCount);
        console.info("freshProducts: " + freshProducts.length);

        if ((totalCount === freshProducts.length || products.length === 0) && !error) {
            moreProductsToFetch = false;
        } else if (error) {
            console.info("Could not fetch Products, waiting 10 seconds until retry");
            await new Promise(r => setTimeout(r, 10000));
        }
        tries++;
    }

    if (freshProducts.length > 0) {
        await FirebaseClient.UpdateProductPrices(freshProducts);
    }

}

testemail();
async function testemail() {
    let d = new Date();
    d.setHours(0);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    let products = await FirebaseClient.GetProductsOnSale(d.getTime());

    await products.map(async p => {
        let date = new Date(p.LastUpdated);
        date.setDate(date.getDate() - 1);
        date.setHours(22);
        date.setMinutes(0);
        date.setSeconds(0);
        date.setMilliseconds(0);

        p.ComparingPrice = p.PriceHistory[p.PriceHistorySorted[1]];
        p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);
    });

    products = products.filter(p => p.SortingDiscount <= 95);
    if (products === undefined || products.length === 0) {
        return;
    }

    SortArray(products, {
        by: "SortingDiscount",
        order: "asc"
    });

    let usedCategories = [];
    var newsLetterProducts = [];
    await products.map(async p => {
        let pp = await FirebaseClient.PrepProduct(p);

        if (products.length < 9) {
            newsLetterProducts.push(pp);
        } else {
            if (newsLetterProducts.length < 9 && !usedCategories.includes(pp.SubType)) {
                newsLetterProducts.push(pp);
                usedCategories.push(pp.SubType);
            }
        }
    });

    var emails = await FirebaseClient.GetEmails();
    var emailClient = new EmailClient(newsLetterProducts, ["matslovstrandberntsen@gmail.com"]);
    await emailClient.SendEmails();
}