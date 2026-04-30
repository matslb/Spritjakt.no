import {onSchedule} from "firebase-functions/v2/scheduler";
import {setGlobalOptions} from "firebase-functions/v2";
import {onDocumentCreated, onDocumentWritten,} from "firebase-functions/v2/firestore";

import FirebaseClient from "./datahandlers/firebaseClient.js";
import VmpClient from "./datahandlers/vmpClient.js";
import NotificationClient from "./datahandlers/notificationService.js";
import firebaseAdmin from "firebase-admin";
import Utils from "./utils.js";
import serviceAccount from "./configs/serviceAccountKey.js";

// Initialize the app with a service account, granting admin privileges
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: "https://spritjakt.firebaseio.com/",
});

setGlobalOptions({region: "europe-west1"});

export const updateStoresV2 = onSchedule("1 1 * * *", async (event) => {
    let stores = await VmpClient.FetchStores();
    try {
        stores = stores.filter((s) => s.storeId != "801");
        await FirebaseClient.UpdateConstants(stores, "Stores");
        console.log("Updated stores");
    } catch (e) {
        console.error(e);
    }
});

export const subscribeClientsToTopicV2 = onDocumentWritten(
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

export const sendNotificationsV2 = onSchedule("1 12 * * *", async (event) => {
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

export const fetchProductRatingOnCreateV2 = onDocumentCreated(
    "Products/{producId}",
    async (event) => {
        const snapshot = event.data;
        const productRef = snapshot.ref;
        const product = snapshot.data();

        if (!product?.Id || product.Id.includes("x")) return;

        const {Id, Name} = product;

        const [source1, source2] = await Promise.all([
            VmpClient.FetchProductRatingFromSource1(Id, Name),
            null // VmpClient.GetProductRatingFromSource2(Name), TODO: Fix vivino
        ]);

        let rating = null;

        if (source1 !== null) {
            rating = Utils.convertRating(source1, 54, 99);
        }

        if (source2 !== null) {
            const converted = Utils.convertRating(source2, 1, 5);

            rating =
                rating != null
                    ? Utils.mergeRatings(converted, rating, 0.4, 1)
                    : converted;
        }

        // Nothing to update
        if (rating == null) return;

        await productRef.update({
            VivinoRating: rating,
            VivinoFetchDate: new Date(),
        });
    }
);

function sortByField(arr, field, ascending = true) {
    return arr.sort((a, b) => {
        if (a[field] < b[field]) return ascending ? -1 : 1;
        if (a[field] > b[field]) return ascending ? 1 : -1;
        return 0;
    });
}
