import firebase from "firebase/app";
import "firebase/messaging";
import SpritjaktClient from "./spritjaktClient";

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