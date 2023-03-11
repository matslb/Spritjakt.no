import firebase from "firebase/compat/app";
import "firebase/compat/messaging";
import SpritjaktClient from "./spritjaktClient";

class NotificationService {
    constructor() {
        this.messaging = firebase.messaging.isSupported() ? firebase.messaging() : null
    }

    AddClientDevice() {
        if (this.messaging === null) {
            return;
        }
        this.messaging.getToken().then(async (currentToken) => {
            await SpritjaktClient.SetUserNotificationToken(currentToken);
        }).catch((err) => {
            console.log('An error occurred while retrieving token. ', err);
        });
    }

}

export default NotificationService;