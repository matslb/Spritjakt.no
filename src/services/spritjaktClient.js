import rp from "request-promise";
import firebase from "firebase/app";
import "firebase/firestore";

const allTimeEarliestDate = 1594166400000;

const allowedTimeSpans = [7, 14, 30, 90];

const getTimeFromNow = (n) => {
  const d = new Date();
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

      await firebase.firestore()
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

              if (p.SortingDiscount && (p.SortingDiscount >= 101 || p.SortingDiscount <= 99) && !this.loadedProducts.find(lp => lp.Id === p.Id)) {
                this.loadedProducts.push(p);
              }
            });
          }
        });
    } else {
      returnProducts.forEach(p => {
        p = this.CalculateProductDiscount(p, startPoint);
      });
    }
    returnProducts = this.loadedProducts.filter(p => p.LastUpdated > startPoint);

    return returnProducts
  }

  CalculateProductDiscount(p, startPoint = Date.now()) {
    let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => (priceDate <= startPoint && parseInt(priceDate) !== parseInt(p.LastUpdated)));
    p.ComparingPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
    p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);
    if (p.ComparingPrice === undefined) {
      p.SortingDiscount = 100;
    }

    return p
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
    return res === undefined ? [] : res;
  }

  async FetchStores() {
    const storesRef = firebase.firestore().collection("Stores").doc("1");
    let storeObject = storesRef.get();
    storeObject = (await storeObject).data();
    return storeObject.StoreList;
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
      notifications: notifications
    });
  }
  async ChangeUserName(name) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      name: name
    });
  }
  async DeleteUserDoc(uid) {
    const usersRef = firebase.firestore().collection("Users").doc(uid);
    await usersRef.delete();
  }

  async UpdateUserNotifications(notifications) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notifications: notifications
    });
  }

  async FetchProductsById(productIds) {
    let products = [];
    for (let i = 0; i < productIds.length; i++) {
      const id = productIds[i];
      const productRef = firebase.firestore().collection("Products").doc(id);
      const productDoc = await productRef.get();
      let p = productDoc.data();
      if (p !== undefined) {
        products.push(this.CalculateProductDiscount(p));
      }
    }
    return products;
  }
  async SetUserNotificationToken(token) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      notificationTokens: firebase.firestore.FieldValue.arrayUnion(token)
    });
  }

  async SaveUserFilter(filter) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      filters: firebase.firestore.FieldValue.arrayUnion(filter)
    });
  }

  async RemoveUserFilter(filter) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      filters: firebase.firestore.FieldValue.arrayRemove(filter)
    });
  }

  async AddProductToUser(productId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      products: firebase.firestore.FieldValue.arrayUnion(productId)
    });
  }

  async RemoveProductFromUser(productId) {
    const user = firebase.auth().currentUser;
    if (!user) return;
    const usersRef = firebase.firestore().collection("Users").doc(user.uid);
    await usersRef.update({
      products: firebase.firestore.FieldValue.arrayRemove(productId)
    });
  }
}

export default SpritjaktClient;
