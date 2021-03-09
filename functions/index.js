const functions = require("firebase-functions");
const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const NotificationClient = require("./datahandlers/notificationClient");
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

const runtimeOpts = {
  timeoutSeconds: 540,
  memory: "512MB",
};

function httpCorsOptions(req, res) {
  res.set("Access-Control-Allow-Origin", "*");
  var exit = false;
  if (req.method === "OPTIONS") {
    // Send response to OPTIONS requests
    res.set("Access-Control-Allow-Methods", "GET");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    res.set("Access-Control-Max-Age", "3600");
    res.status(204).send("");
    exit = true;
  }
  //PingCall just to keep function alive
  if (req.query.pingCall) {
    res.send("It lives another day...");
    exit = true;
  }

  return { res, exit };
}

exports.updateProducts = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("45 6 * * *").timeZone("Europe/Paris").onRun(async (context) => {
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
      console.info("Could not fetch Products, waiting 1 second until retry");
      await new Promise(r => setTimeout(r, 1000));
    }
    tries++;
  }

  if (freshProducts.length > 0) {
    await FirebaseClient.PricesToBeFetched(freshProducts);
  }
});

exports.updateStocks = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("30 7 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let moreStocksToFetch = true;
  let freshStocks = [];
  let tries = 0;
  /* while (moreStocksToFetch && tries < 20) {
     let { totalCount, stocks, error } = await VmpClient.FetchFreshStocks(freshStocks.length);
 
     freshStocks = freshStocks.concat(stocks);
     console.info("freshStocks: " + freshStocks.length);
 
     if ((totalCount === freshStocks.length || stocks.length === 0) && !error) {
       moreStocksToFetch = false;
     } else if (error) {
       console.info("Could not fetch stocks, waiting 10 seconds until retry");
       await new Promise(r => setTimeout(r, 10000));
     }
     tries++;
   }
   freshStocks = freshStocks.length > 3000 ? freshStocks.slice(0, 2999) : freshStocks; 
   */
  await FirebaseClient.SetStockUpdateList(freshStocks, true);
});

exports.productSearch = functions.region("europe-west1").runWith(runtimeOpts).https.onRequest(async (req, oldRes) => {
  let { res, exit } = httpCorsOptions(req, oldRes);
  if (exit) {
    return;
  }
  if (
    req.query.searchString === undefined ||
    req.query.searchString.trim().length === 0
  ) {
    return res.status(400).send();
  }
  searchString = req.query.searchString.toLowerCase();
  let stringList = searchString.split(" ").filter((s) => s.length > 1);
  var products = await FirebaseClient.ProductSearchAdvanced(stringList);
  let matchingProducts = [];
  Object.keys(products).forEach((id) => {
    let p = products[id];

    let nameList = p.Name.toLowerCase()
      .split(" ")
      .filter((s) => s.length > 1);

    p.searchmatch = 0;
    for (i in stringList) {
      if (nameList.includes(stringList[i])) {
        p.searchmatch++;
        if (i !== 0 && nameList.includes(stringList[i - 1])) {
          p.searchmatch++;
        }
      }
      if (nameList[i] === stringList[i]) {
        p.searchmatch++;
      }
    }
    matchingProducts.push(p);
  });

  SortArray(matchingProducts, {
    by: ["searchmatch", "Name"],
    order: "desc",
  });

  return res.send(matchingProducts.splice(0, 2500));
});

exports.priceUpdater = functions.region("europe-west1").runWith(runtimeOpts).database.ref("/PricesToBeFetched/").onWrite(async (change, context) => {

  if (!change.after.exists()) {
    return null;
  }
  const newValue = change.after.val();
  const count = newValue.length > 500 ? 500 : newValue.length;
  for (let i = 0; i < count; i++) {
    if (newValue[i] !== undefined) {
      let product = await VmpClient.FetchProductPrice(newValue[i]);
      if (product !== null) {
        await FirebaseClient.UpdateProductPrice(product);
      }
    }
    newValue.splice(i, 1);
  }

  return await FirebaseClient.SetStockUpdateList(newValue);
});


exports.stockUpdater = functions.region("europe-west1").runWith(runtimeOpts).database.ref("/StocksToBeFetched/").onWrite(async (change, context) => {

  if (!change.after.exists()) {
    return null;
  }
  let stores = await FirebaseClient.getConstant("Stores");
  const newValue = change.after.val();
  const count = newValue.length > 50 ? 50 : newValue.length;
  for (let i = 0; i < count; i++) {
    if (newValue[i] !== undefined) {
      let storeStock = await VmpClient.FetchStoreStock(newValue[i].productId, stores);
      if (storeStock !== null) {
        newValue[i].Stores = storeStock;
        await FirebaseClient.UpdateProductStock(newValue[i]);
      }
    }
    newValue.splice(i, 1);
  }

  return await FirebaseClient.SetStockUpdateList(newValue);
});

exports.subscribeClientsToTopic = functions.region("europe-west1").firestore.document('Users/{userId}').onWrite((change, context) => {
  let userId = context.params.userId;
  let oldUserData = change.before.data() || {};
  let newUserData = change.after.data() || {};
  let tokensToRemove = [];
  let tokensToAdd = [];

  if (typeof oldUserData.notificationTokens !== "undefined") {
    tokensToRemove = oldUserData.notificationTokens.filter(t => typeof newUserData.notificationTokens === "undefined" || !newUserData.notificationTokens.includes(t));
  }
  if (typeof newUserData.notificationTokens !== "undefined") {
    tokensToAdd = newUserData.notificationTokens.filter(t => typeof oldUserData.notificationTokens === "undefined" || !oldUserData.notificationTokens.includes(t));
  }
  console.log("tokensToAdd:", tokensToAdd);
  console.log("tokensToRemove:", tokensToRemove);

  if (tokensToAdd.length > 0) {
    firebaseAdmin.messaging().subscribeToTopic(tokensToAdd, userId)
      .then(function (response) {
        console.log('Successfully subscribed to topic:', response);
      })
      .catch(function (error) {
        console.log('Error subscribing to topic:', error);
      });
  }

  if (tokensToRemove.length > 0) {
    firebaseAdmin.messaging().unsubscribeFromTopic(tokensToRemove, userId)
      .then(function (response) {
        console.log('Successfully unsubscribed from topic:', response);
      })
      .catch(function (error) {
        console.log('Error unsubscribing from topic:', error);
      });
  }
});

exports.sendNotifications = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("45 9 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let d = new Date();
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  let products = await FirebaseClient.GetProductsOnSale(d.getTime() - (2 * 60 * 60 * 1000));
  products.map(async p => {

    p.ComparingPrice = p.PriceHistory[p.PriceHistorySorted[1]];
    if (p.ComparingPrice) {
      p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);
    } else {
      p.SortingDiscount = 100;
    }
  });
  products = products.filter(p => p.SortingDiscount <= 95 && (p.ProductStatusSaleName === undefined || p.ProductStatusSaleName !== "Utgått"));
  if (products === undefined || products.length === 0) {
    return;
  }

  SortArray(products, {
    by: "SortingDiscount",
    order: "asc"
  });

  let users = await FirebaseClient.GetUsers();
  await NotificationClient.sendNotifications(products, users);
  console.log("Notifications complete");
});
