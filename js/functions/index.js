const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const {
  onDocumentCreated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");

const FirebaseClient = require("./datahandlers/firebaseClient");
const VmpClient = require("./datahandlers/vmpClient");
const NotificationClient = require("./datahandlers/notificationService");
const firebaseAdmin = require("firebase-admin");
const serviceAccount = require("./configs/serviceAccountKey.json");
const Utils = require("./utils");
// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(serviceAccount),
  databaseURL: "https://spritjakt.firebaseio.com/",
});

setGlobalOptions({ region: "europe-west1" });

exports.updateStoresV2 = onSchedule("1 1 * * *", async (event) => {
  let stores = await VmpClient.FetchStores();
  try {
    stores = stores.filter((s) => s.storeId != "801");
    await FirebaseClient.UpdateConstants(stores, "Stores");
    console.log("Updated stores");
  } catch (e) {
    console.error(e);
  }
});

exports.subscribeClientsToTopicV2 = onDocumentWritten(
  "Users/{userId}",
  (event) => {
    let userId = event.data.before.id;
    let oldUserData = event.data.before.data() || {};
    let newUserData = event.data.after.data() || {};
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
  }
);

exports.sendNotificationsV2 = onSchedule("1 12 * * *", async (event) => {
  let d = new Date();
  d.setHours(0);
  d.setMinutes(0);
  d.setSeconds(0);
  d.setMilliseconds(0);
  let products = await FirebaseClient.GetProductsOnSale(d.getTime());
  if (products === undefined || products.length === 0) {
    return;
  }

  products = sortByField(products, "PriceChange", true);

  let users = await FirebaseClient.GetUsers();

  await NotificationClient.sendNotifications(products, users);
  console.log("Notifications complete");
});

exports.fetchProductRatingOnCreateV2 = onDocumentCreated(
  "Products/{producId}",
  async (event) => {
    const snapshot = event.data;
    const product = snapshot.data();
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
);

function sortByField(arr, field, ascending = true) {
  return arr.sort((a, b) => {
    if (a[field] < b[field]) return ascending ? -1 : 1;
    if (a[field] > b[field]) return ascending ? 1 : -1;
    return 0;
  });
}
