import firebase from "firebase";
import "firebase/messaging";
import SpritjaktClient from "./spritjaktClient";
const firebaseConfig = require("../config.json");

class NotificationService {
    constructor() {
        this.messaging = firebase.messaging();
        this.spritjaktclient = new SpritjaktClient();
    }

    AddClientDevice() {
        this.messaging.getToken().then(async (currentToken) => {
            await this.spritjaktclient.SetUserNotificationToken(currentToken);
        }).catch((err) => {
            console.log('An error occurred while retrieving token. ', err);
        });
    }

}

export default NotificationService;