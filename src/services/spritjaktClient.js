import rp from "request-promise";
import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/analytics";
import SortArray from "sort-array";

const allTimeEarliestDate = 1594166400000;

const allowedTimeSpans = [1, 7, 14, 30, 90, 180];

const getTimeFromNow = (n) => {
  const d = new Date();
  n = n > allowedTimeSpans[allowedTimeSpans.length - 1] ? allowedTimeSpans[allowedTimeSpans.length - 1] : n;
  d.setDate(d.getDate() - n);
  return d.getTime();
}


class SpritjaktClient {

  constructor() {
    this.usedTimeSpans = [];
    this.lastFetchGetLowerPrice = false;
    this.loadedProducts = [];
  }

  async FetchProducts(timeSpan, getLowerPrice) {
    let startPoint = getTimeFromNow(timeSpan);

    let fetchNew = false;

    if (this.lastFetchGetLowerPrice !== getLowerPrice) {
      fetchNew = true;
      this.usedTimeSpans = [];
      this.loadedProducts = [];
      this.lastFetchGetLowerPrice = getLowerPrice;
    }
    if (startPoint > allTimeEarliestDate) {
      startPoint = startPoint - (2 * 60 * 60 * 1000);
    } else {
      startPoint = allTimeEarliestDate;
    }
    let returnProducts = [];
    if (!this.usedTimeSpans.includes(timeSpan) || fetchNew) {
      let endAtPoint = Date.now();
      allowedTimeSpans.forEach(ts => {
        if (ts <= timeSpan) {
          if (!this.usedTimeSpans.includes(ts)) {
            this.usedTimeSpans.push(ts);
          } else {
            endAtPoint = getTimeFromNow(ts);
          }
        }
      });

      return await firebase.firestore()
        .collection("Products")
        .where("LastUpdated", ">=", startPoint)
        .orderBy("LastUpdated")
        .where("PriceIsLowered", "==", getLowerPrice)
        .endBefore(endAtPoint)
        .get()
        .then((qs) => {
          if (!qs.empty) {
            qs.forEach((p) => {
              p = p.data();

              p = this.CalculateProductDiscount(p, startPoint);

              if (p.Discount && (p.Discount >= 101 || p.Discount <= 99) && !this.loadedProducts.find(lp => lp.Id === p.Id) && p.Type !== "Alkoholfritt") {
                this.loadedProducts.push(p);
              }
            });
          }
          return this.loadedProducts.filter(p => p.LastUpdated > startPoint);
        });
    } else {
      returnProducts.forEach(p => {
        p = this.CalculateProductDiscount(p, startPoint);
      });
      return this.loadedProducts.filter(p => p.LastUpdated > startPoint);
    }
  }

  CalculateProductDiscount(p, startPoint = Date.now()) {
    let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => (priceDate <= startPoint && parseInt(priceDate) !== parseInt(p.LastUpdated)));
    p.ComparingPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
    p.Discount = (p.LatestPrice / p.ComparingPrice * 100);
    p.Literprice = Math.ceil(p.LatestPrice / (p.Volume * 100) * 100);
    p.LiterPriceAlcohol = Math.ceil((100 / p.Alcohol) * p.Literprice);
    if (p.ComparingPrice === undefined) {
      p.Discount = 100;
    }
    return p;
  }

  async SearchProducts(searchString) {
    let options = {
      uri:
        "https://europe-west1-spritjakt.cloudfunctions.net/productSearch",
      qs: {
        searchString: searchString,
      },
      json: true,
    };
    let res = await rp(options)
      .then(function (res) {
        return res;
      })
      .catch(function (err) {
        console.log(err);
      });
    let results = [];
    res.forEach((p) => {
      p = this.CalculateProductDiscount(p, getTimeFromNow(allowedTimeSpans[3]));
      if (!results.find(lp => lp.Id === p.Id) && p.Type !== "Alkoholfritt") {
        results.push(p);
      }
    });
    return results;
  }

  async FetchStores() {
    const storesRef = firebase.firestore().collection("Constants").doc("Stores");
    let storeObject = storesRef.get();
    storeObject = (await storeObject).data();
    SortArray(storeObject.Stores, {
      by: ["storeName"]
    });
    storeObject.Stores.unshift({
      storeId: "online",
      storeName: "Nettlager"
    });
    return storeObject.Stores;
  }

  async FetchProductTypes() {
    const ref = firebase.firestore().collection("Constants").doc("ProductTypes");
    let object = ref.get();
    let data = (await object).data();
    let productTypes = {};
    data.ProductTypes.forEach(pt => {
      productTypes[pt] = {
        products: 0,
        state: false
      }
    });
    return productTypes;
  }

  async CreateUserDoc(name, notifications) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.set({
      name: name,
      notifications: notifications,
      notificationsConsentDate: new Date()
    });
  }

  async ChangeUserName(name) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      name: name
    });
    firebase.analytics().logEvent("user_change_username");
  }

  async DeleteUserDoc(uid) {
    const usersRef = firebase.firestore().collection("Users").doc(uid);
    await this.PurgeUserNotificationTokens();
    await usersRef.delete();
    firebase.analytics().logEvent("user_delete_profile");
  }

  async UpdateUserNotifications(notifications) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notifications: notifications,
      notificationsConsentDate: new Date()
    });
    firebase.analytics().logEvent("user_update_notifications");
  }

  async FetchProductsById(productIds) {
    let products = [];
    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i];
      let p = await this.FetchProductById(id);
      if (p !== undefined) {
        products.push(p);
      }
    }
    return products;
  }

  async FetchProductById(id) {
    const productRef = firebase.firestore().collection("Products").doc(id);
    const productDoc = await productRef.get();
    let p = productDoc.data();
    if (p !== undefined) {
      this.CalculateProductDiscount(p);
    }
    return p;
  }

  async SetUserNotificationToken(token) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    await usersRef.update({
      notificationTokens: firebase.firestore.FieldValue.arrayUnion(token)
    });
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
  }

  async PurgeUserNotificationTokens() {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notificationTokens: []
    });
  }

  async SaveUserFilter(filter) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      filters: firebase.firestore.FieldValue.arrayUnion(filter)
    });
    firebase.analytics().logEvent("user_save_filter");
  }

  async RemoveUserFilter(filter) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      filters: firebase.firestore.FieldValue.arrayRemove(filter)
    });
    firebase.analytics().logEvent("user_delete_filter");
  }

  async AddProductToUser(productId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      products: firebase.firestore.FieldValue.arrayUnion(productId)
    });
    firebase.analytics().logEvent("user_add_favorite");
  }

  async RemoveProductFromUser(productId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      products: firebase.firestore.FieldValue.arrayRemove(productId)
    });
    firebase.analytics().logEvent("user_delete_favorite");
  }
}

export default SpritjaktClient;
