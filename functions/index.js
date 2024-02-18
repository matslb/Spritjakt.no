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

exports.updateStores = functions
  .region("europe-west1")
  .runWith(runtimeOpts)
  .pubsub.schedule("1 1 * * *")
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
    let stores = await VmpClient.FetchStores();
    try {
      stores = stores.filter((s) => s.storeId != "801");
      await FirebaseClient.UpdateConstants(stores, "Stores");
      console.log("Updated stores");
    } catch (e) {
      console.error(e);
    }
  });

exports.subscribeClientsToTopic = functions
  .region("europe-west1")
  .firestore.document("Users/{userId}")
  .onWrite((change, context) => {
    let userId = context.params.userId;
    let oldUserData = change.before.data() || {};
    let newUserData = change.after.data() || {};
    let tokensToRemove = [];
    let tokensToAdd = [];

    if (typeof oldUserData.notificationTokens !== "undefined") {
      tokensToRemove = oldUserData.notificationTokens.filter(
        (t) =>
          typeof newUserData.notificationTokens === "undefined" ||
          !newUserData.notificationTokens.includes(t)
      );
    }
    if (typeof newUserData.notificationTokens !== "undefined") {
      tokensToAdd = newUserData.notificationTokens.filter(
        (t) =>
          typeof oldUserData.notificationTokens === "undefined" ||
          !oldUserData.notificationTokens.includes(t)
      );
    }
    console.log("tokensToAdd:", tokensToAdd);
    console.log("tokensToRemove:", tokensToRemove);

    if (tokensToAdd.length > 0) {
      firebaseAdmin
        .messaging()
        .subscribeToTopic(tokensToAdd, userId)
        .then(function (response) {
          console.log("Successfully subscribed to topic:", response);
        })
        .catch(function (error) {
          console.log("Error subscribing to topic:", error);
        });
    }

    if (tokensToRemove.length > 0) {
      firebaseAdmin
        .messaging()
        .unsubscribeFromTopic(tokensToRemove, userId)
        .then(function (response) {
          console.log("Successfully unsubscribed from topic:", response);
        })
        .catch(function (error) {
          console.log("Error unsubscribing from topic:", error);
        });
    }
  });

exports.sendNotifications = functions
  .region("europe-west1")
  .runWith(runtimeOpts)
  .pubsub.schedule("1 12 * * *")
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
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
      order: "asc",
    });

    let users = await FirebaseClient.GetUsers();
    await NotificationClient.sendNotifications(products, users);
    console.log("Notifications complete");
  });

exports.checkProductRatings = functions
  .region("europe-west1")
  .runWith(runtimeOpts)
  .pubsub.schedule("1 8 * * *")
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
    let products = await FirebaseClient.GetProductsWithOldRating();
    for (const p of products) {
      if (!p.Id.includes("x")) {
        let ratingResult = await VmpClient.FetchProductRating(p.Id, p.Name);
        await FirebaseClient.UpdateProductRating(ratingResult);
      }
    }
  });

exports.fetchProductRatingOnCreate = functions
  .region("europe-west1")
  .runWith(runtimeOpts)
  .firestore.document("Products/{producId}")
  .onCreate(async (snap, context) => {
    const product = snap.data();
    if (!product.Id.includes("x")) {
      let ratingResult = await VmpClient.FetchProductRating(
        product.Id,
        product.Name
      );
      await FirebaseClient.UpdateProductRating(ratingResult);

      var productRef = firebaseAdmin.firestore().collection("Products").doc(Id);
      var p = (await productRef.get()).data();
      let { rating, url } = await VmpClient.GetProductRatingFromVivino(p.Name);
      if (rating != null) {
        productRef.update({
          VivinoRating: rating,
          VivinoUrl: url,
          VivinoFetchDate: new Date(),
        });
      }
    }
  });
