import {onRequest, Request} from "firebase-functions/https";
import {logger} from "firebase-functions";
import e from "express";
import {FirestoreEvent, onDocumentWritten} from "firebase-functions/firestore";
import User from "../../Models/User";

const regionConfig = {
  region: "europe-north1",
};
export const TestFunction = onRequest(regionConfig,
    (request: Request, response: e.Response) => {
      logger.info("Hello logs!", {structuredData: true});
      response.send("Hello from Firebase!");
    });

exports.makeuppercase = onDocumentWritten(
    "/Users/{userId}", (event) => {
      const oldUserData = event.data?.before.data() as User;
      const newUserData = event.data?.after.data() as User;

      const tokensToRemove :string[] = [];
      let tokensToAdd :string[] = [];

      if (oldUserData.notificationTokens.length === newUserData.notificationTokens.length) {
        return;
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
            .then(function(response) {
              console.log("Successfully subscribed to topic:", response);
            })
            .catch(function(error) {
              console.log("Error subscribing to topic:", error);
            });
      }

      if (tokensToRemove.length > 0) {
        firebaseAdmin
            .messaging()
            .unsubscribeFromTopic(tokensToRemove, userId)
            .then(function(response) {
              console.log("Successfully unsubscribed from topic:", response);
            })
            .catch(function(error) {
              console.log("Error unsubscribing from topic:", error);
            });
      }
    });
