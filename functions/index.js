const functions = require("firebase-functions");
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
  memory: "512MB",
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
    for (const product of products) {
      if (!product.Id.includes("x")) {
        let ratingResult = await VmpClient.FetchProductRating(
          product.Id,
          product.Name
        );

        var productRef = firebaseAdmin
          .firestore()
          .collection("Products")
          .doc(Id);
        var p = (await productRef.get()).data();
        let { vivinoRating, url } = await VmpClient.GetProductRatingFromVivino(
          p.Name
        );

        var rating = Utils.convertRating(ratingResult.rating, 54, 99);

        if (vivinoRating != undefined) {
          var vivinoconverted = Utils.convertRating(vivinoRating, 1, 5);
          rating = Utils.mergeRatings(vivinoconverted, rating, 0.4, 1);
        }

        if (rating != null) {
          productRef.update({
            VivinoRating: rating,
            VivinoFetchDate: new Date(),
          });
        }
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

      var productRef = firebaseAdmin.firestore().collection("Products").doc(Id);
      var p = (await productRef.get()).data();
      let { vivinoRating, url } = await VmpClient.GetProductRatingFromVivino(
        p.Name
      );

      var rating = Utils.convertRating(ratingResult.rating, 54, 99);

      if (data.VivinoRating != undefined) {
        var vivino = Utils.convertRating(data.VivinoRating, 1, 5);
        if (data.Rating != undefined) {
          rating = Utils.mergeRatings(vivino, rating, 0.4, 1);
        } else {
          rating = Utils.mergeRatings(vivino, vivino - 0.2, 0.4, 1);
        }
      }

      if (rating != null) {
        productRef.update({
          VivinoRating: rating,
          VivinoFetchDate: new Date(),
        });
      }
    }
  });
