import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/analytics";
import SortArray from "sort-array";
import axios from "axios";
import UserCacher from "./userCache";
import sortArray from "sort-array";

class SpritjaktClient {
  static async FetchProductsById(productIds = []) {
    var products = [];
    var productIdsCopy = Object.assign([], productIds);
    while (productIds.length > 0) {
      var batchIds = productIds.splice(0, 10);
      await firebase
        .firestore()
        .collection("Products")
        .where(firebase.firestore.FieldPath.documentId(), "in", batchIds)
        .get()
        .then((docs) => {
          docs.forEach((doc) => {
            let p = doc.data();
            products.push(p);
          });
        });
    }
    sortArray(products, {
      by: "Name",
    });
    return products;
  }

  static async FetchProductById(id) {
    const productRef = firebase.firestore().collection("Products").doc(id);
    const productDoc = await productRef.get();
    let p = productDoc.data();
    return p;
  }

  static async FetchIdByBarcode(code) {
    let data = await axios(
      "https://app.vinmonopolet.no/vmpws/v2/vmp/products/barCodeSearch/" +
        code +
        "?fields=code"
    )
      .then(function (response) {
        return response.data;
      })
      .catch(function (error) {
        return null;
      });
    return data?.code;
  }
  static async FetchStores() {
    let stores = await this.GetConstant("Stores");
    SortArray(stores, {
      by: ["storeName"],
    });
    stores.unshift({
      storeId: "online",
      storeName: "Nettlager",
    });
    return stores;
  }

  static async GetConstant(type) {
    const typeRef = firebase.firestore().collection("Constants").doc(type);
    let dataObject = typeRef.get();
    dataObject = (await dataObject).data();
    return dataObject[type];
  }

  static async CreateUserDoc(name, notifications) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.set({
      name: name,
      notifications: notifications,
      products: [],
      notificationsConsentDate: new Date(),
    });
    UserCacher.set((await usersRef.get()).data());
  }

  static async ChangeUserName(name) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      name: name,
    });
    UserCacher.set((await usersRef.get()).data());
    firebase.analytics().logEvent("user_change_username");
  }

  static async DeleteUserDoc(uid) {
    await firebase
      .firestore()
      .collection("Users")
      .doc(uid)
      .delete()
      .then(() => {
        console.log("Document successfully deleted!");
      })
      .catch((error) => {
        console.error("Error removing document: ", error);
      });
    UserCacher.delete();
    firebase.analytics().logEvent("user_delete_profile");
    return;
  }

  static async UpdateUserNotifications(notifications) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notifications: notifications,
      notificationsConsentDate: new Date(),
    });
    UserCacher.set((await usersRef.get()).data());
    firebase.analytics().logEvent("user_update_notifications");
  }

  static async SetUserNotificationToken(token) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notificationTokens: firebase.firestore.FieldValue.arrayUnion(token),
    });
  }

  static async PurgeUserNotificationTokens() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notificationTokens: [],
    });
  }

  static async SaveUserFilter(filter) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    console.log(filter);
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      filters: firebase.firestore.FieldValue.arrayUnion(filter),
    });
    UserCacher.set((await usersRef.get()).data());
    firebase.analytics().logEvent("user_save_filter");
  }

  static async RemoveUserFilter(filter) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    delete filter.sort;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      filters: firebase.firestore.FieldValue.arrayRemove(filter),
    });
    UserCacher.set((await usersRef.get()).data());
    firebase.analytics().logEvent("user_delete_filter");
  }

  static async AddProductToUser(productId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      products: firebase.firestore.FieldValue.arrayUnion(productId),
    });
    UserCacher.set((await usersRef.get()).data());
    firebase.analytics().logEvent("user_add_favorite");
  }

  static async RemoveProductFromUser(productId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      products: firebase.firestore.FieldValue.arrayRemove(productId),
    });
    UserCacher.set((await usersRef.get()).data());
    firebase.analytics().logEvent("user_delete_favorite");
  }
}

export default SpritjaktClient;
