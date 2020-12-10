import firebase from "firebase/app";
import "firebase/messaging";
import SpritjaktClient from "./spritjaktClient";

class NotificationService {
    constructor() {
        this.messaging = firebase.messaging.isSupported() ? firebase.messaging() : null
        this.spritjaktclient = new SpritjaktClient();
    }

    AddClientDevice() {
        if (this.messaging === null) {
            return;
        }
        this.messaging.getToken().then(async (currentToken) => {
            await this.spritjaktclient.SetUserNotificationToken(currentToken);
        }).catch((err) => {
            console.log('An error occurred while retrieving token. ', err);
        });
    }

}

export default NotificationService;