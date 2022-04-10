const functions = require("firebase-functions");
const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const NotificationClient = require("./datahandlers/notificationService");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const SortArray = require("sort-array");
// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://spritjakt.firebaseio.com/",
});

const runtimeOpts = {
  timeoutSeconds: 540,
  memory: "512MB",
};

exports.fetchNewProducts = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("1 6 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let moreProductsToFetch = true;
  let freshProducts = [];
  let tries = 0;
  let date = new Date();
  let dayofMonth = date.getDate();
  let offset = dayofMonth % 2 === 0 ? 15000 : 0
  while (moreProductsToFetch && tries < 20) {
    let { totalCount, products, error } = await VmpClient.FetchFreshProducts(freshProducts.length + offset);

    freshProducts = freshProducts.concat(products);
    console.log(totalCount);
    console.info("freshProducts: " + freshProducts.length);

    if (!error && (
      totalCount === freshProducts.length
      || products.length === 0
      || (dayofMonth !== 1 && freshProducts.length >= 10000)
    )) {
      moreProductsToFetch = false;
    } else if (error) {
      console.info("Could not fetch Products, waiting 1 second until retry");
      await new Promise(r => setTimeout(r, 1000));
    }
    tries++;
  }

  if (freshProducts.length > 0) {
    await FirebaseClient.SetPriceUpdateList(freshProducts);
  }
});

exports.updateStores = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("1 1 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let stores = await VmpClient.FetchStores();
  try {
    stores = stores.filter((s) => s.storeId != "801")
    await FirebaseClient.UpdateConstants(stores, "Stores");
    console.log("Updated stores");
  } catch (e) {
    console.error(e);
  }
});

exports.fetchNewStocks = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("1 11 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let ids = await FirebaseClient.GetProductIdsForStock();
  let d = new Date();
  d.setDate(d.getDate() - 2);
  d.setHours(0);
  let onSaleIds = await FirebaseClient.GetProductsOnSale(d.getTime());
  if (onSaleIds && onSaleIds.length > 0)
    ids = [...new Set(onSaleIds.concat(ids))];
  console.log("Updating " + ids.length + " stocks");
  await FirebaseClient.SetStockUpdateList(ids);
});

exports.priceUpdater = functions.region("europe-west1").runWith(runtimeOpts).database.ref("/PricesToBeFetched/").onWrite(async (change, context) => {

  if (!change.after.exists()) {
    return null;
  }
  const newValue = change.after.val();
  const count = newValue.length > 50 ? 50 : newValue.length;
  console.log("Total count: " + newValue.length);
  console.log("Updating in this batch: " + count);
  for (let i = 0; i < count; i++) {
    if (newValue[i] !== undefined) {
      let product = await VmpClient.FetchProductPrice(newValue[i]);
      if (product !== null) {
        await FirebaseClient.UpdateProductPrice(product);
      }
    }
    newValue.splice(i, 1);
  }
  return await FirebaseClient.SetPriceUpdateList(newValue);
});


exports.stockUpdater = functions.region("europe-west1").runWith(runtimeOpts).database.ref("/StocksToBeFetched/").onWrite(async (change, context) => {

  if (!change.after.exists()) {
    return null;
  }
  let stores = await FirebaseClient.GetConstant("Stores");
  const newValue = change.after.val();
  const count = newValue.length > 50 ? 50 : newValue.length;
  for (let i = 0; i < count; i++) {
    if (newValue[i] !== undefined) {
      let storeStock = await VmpClient.FetchStoreStock(newValue[i], stores);
      if (storeStock !== null) {
        let p = {
          productId: newValue[i],
          Stores: storeStock
        }
        await FirebaseClient.UpdateProductStock(p);
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

exports.sendNotifications = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("1 13 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let d = new Date();
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  let products = await FirebaseClient.GetProductsOnSale(d.getTime());
  if (products === undefined || products.length === 0) {
    return;
  }

  SortArray(products, {
    by: "PriceChange",
    order: "asc"
  });

  let users = await FirebaseClient.GetUsers();
  await NotificationClient.sendNotifications(products, users);
  console.log("Notifications complete");
});


exports.checkProductRatings = functions.region("europe-west1").runWith(runtimeOpts).pubsub.schedule("1 8 * * *").timeZone("Europe/Paris").onRun(async (context) => {
  let products = await FirebaseClient.GetProductsWithOldRating();
  for (const p of products) {
    if (!p.Id.includes("x")) {
      let ratingResult = await VmpClient.FetchProductRating(p.Id, p.Name);
      await FirebaseClient.UpdateProductRating(ratingResult);
    }
  }
});

exports.fetchProductRatingAndStockOnCreate = functions.region("europe-west1").runWith(runtimeOpts).firestore.document('Products/{producId}').onCreate(async (snap, context) => {
  const product = snap.data()
  if (!product.Id.includes("x")) {
    let ratingResult = await VmpClient.FetchProductRating(product.Id, product.Name);
    await FirebaseClient.UpdateProductRating(ratingResult);
  }

  let stores = await FirebaseClient.GetConstant("Stores");
  let storeStock = await VmpClient.FetchStoreStock(product.Id, stores);
  if (storeStock !== null) {
    let p = {
      productId: product.Id,
      Stores: storeStock
    }
    await FirebaseClient.UpdateProductStock(p);
  }
});


