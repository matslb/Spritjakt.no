const functions = require("firebase-functions/v1");
const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const NotificationClient = require("./datahandlers/notificationService");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const SortArray = require("sort-array");
const Utils = require("./utils");
// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://spritjakt.firebaseio.com/",
});

const runtimeOpts = {
  timeoutSeconds: 540,
  memory: "256MB",
};

exports.updateStores = functions
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
  .runWith(runtimeOpts)
  .region("europe-west1")
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

    product = sortByField(products, "PriceChange", true);

    let users = await FirebaseClient.GetUsers();

    await NotificationClient.sendNotifications(products, users);
    console.log("Notifications complete");
  });

exports.checkProductRatings = functions
  .runWith(runtimeOpts)
  .region("europe-west1")
  .pubsub.schedule("1 8 * * *")
  .timeZone("Europe/Paris")
  .onRun(async (context) => {
    let products = await FirebaseClient.GetProductsWithOldRating();
    for (const product of products) {
      if (!product.Id.includes("x")) {
        let rating1 = await VmpClient.FetchProductRatingFromSource1(
          product.Id,
          product.Name
        );
        var productRef = firebaseAdmin
          .firestore()
          .collection("Products")
          .doc(product.Id);
        var p = (await productRef.get()).data();
        let { rating2, url } = await VmpClient.GetProductRatingFromSource2(
          p.Name
        );

        var rating = null;
        if (rating1.rating != null) {
          rating = Utils.convertRating(rating1.rating, 54, 99);
        }

        if (rating2 != undefined) {
          var convertedrating2 = Utils.convertRating(rating2, 1, 5);
          if (rating1.rating != null) {
            rating = Utils.mergeRatings(convertedrating2, rating, 0.4, 1);
          } else {
            rating = convertedrating2 - 0.2;
          }
        }

        productRef.update({
          VivinoRating: rating,
          VivinoFetchDate: new Date(),
        });
      }
    }
  });

exports.fetchProductRatingOnCreate = functions
  .runWith(runtimeOpts)
  .region("europe-west1")
  .firestore.document("Products/{producId}")
  .onCreate(async (snap, context) => {
    const product = snap.data();
    if (!product.Id.includes("x")) {
      let rating1 = await VmpClient.FetchProductRatingFromSource1(
        product.Id,
        product.Name
      );

      var productRef = firebaseAdmin
        .firestore()
        .collection("Products")
        .doc(product.Id);
      var p = (await productRef.get()).data();
      let { rating2, url } = await VmpClient.GetProductRatingFromSource2(
        p.Name
      );

      var rating = null;
      if (rating1.rating != null) {
        rating = Utils.convertRating(rating1.rating, 54, 99);
      }

      if (rating2 != undefined) {
        var convertedrating2 = Utils.convertRating(rating2, 1, 5);
        if (rating1.rating != null) {
          rating = Utils.mergeRatings(convertedrating2, rating, 0.4, 1);
        } else {
          rating = convertedrating2 - 0.2;
        }
      }

      productRef.update({
        VivinoRating: rating,
        VivinoFetchDate: new Date(),
      });
    }
  });

function sortByField(arr, field, ascending = true) {
  return arr.sort((a, b) => {
    if (a[field] < b[field]) return ascending ? -1 : 1;
    if (a[field] > b[field]) return ascending ? 1 : -1;
    return 0;
  });
}
