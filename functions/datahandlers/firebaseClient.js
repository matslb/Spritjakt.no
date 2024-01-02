const firebase = require("firebase-admin");
const sortArray = require("sort-array");
require("firebase/firestore");
require("firebase/auth");

module.exports = class FirebaseClient {
  static async UpsertProduct(p) {
    let today = this.GetTodayTimeStamp();
    const productRef = firebase.firestore().collection("Products").doc(p.Id);

    if (p.ProductHistory == undefined) {
      p = this.SetProductHistory(p);
    }
    p.LastPriceFetchDate = new Date(1, 1);
    p.LastUpdated = today;
    try {
      await productRef.set(p);
    } catch (error) {
      console.log(error);
    }
  }

  static GetTodayTimeStamp() {
    let d = new Date();
    d.setHours(0 - d.getTimezoneOffset() / 60);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    return d.getTime();
  }

  static async UpdateProduct(p) {
    let today = this.GetTodayTimeStamp();

    const productRef = firebase.firestore().collection("Products").doc(p.Id);
    const productDoc = await productRef.get();
    let sp = productDoc.data();

    productRef.update({ LastPriceFetchDate: new Date() });

    if (
      p.Year &&
      sp.Year &&
      p.Year != "0000" &&
      sp.Year != "0000" &&
      sp.Year != p.Year &&
      !p.VintageComment?.includes("ikke egnet for lagring")
    ) {
      await this.CreateNewProductVintage(sp);
      // Resetting fiels that will be copied to vintage.
      p = this.SetProductHistory(p);
      delete p.PriceIsLowered;
      delete p.PriceChange;
    } else if (sp.PriceHistory) {
      p.PriceHistory = sp.PriceHistory;
    } else {
      p = this.SetProductHistory(p);
    }
    if (p.Price !== null || p.Price !== undefined) {
      p.LatestPrice = p.Price;
      p.Literprice = Math.ceil((p.Price / p.Volume) * 100);
      p.LiterPriceAlcohol = Math.ceil((100 / sp.Alcohol) * p.Literprice);

      let ComparingPrice = sp.PriceHistory[sp.LastUpdated] ?? p.Price;
      let PriceChange = (p.Price / ComparingPrice) * 100;

      if (PriceChange !== 100 && (PriceChange <= 98 || PriceChange >= 102)) {
        p.PriceIsLowered = PriceChange < 100;
        p.PriceChange = Math.round(PriceChange * 100) / 100;
        p.PriceHistory[today] = p.Price;
        p.LastUpdated = today;
        p.PriceHistorySorted = sortArray(Object.keys(p.PriceHistory), {
          order: "desc",
        });
      }
    }
    p.PriceChanges = p.PriceHistorySorted?.length || 0;
    await productRef.update({ ...p });
  }

  static SetProductHistory(p) {
    let today = this.GetTodayTimeStamp();
    p.PriceHistory = {
      [today]: p.Price,
    };
    p.PriceHistorySorted = [today];
    return p;
  }

  static async ExpireProduct(id) {
    const productRef = firebase.firestore().collection("Products").doc(id);
    await productRef.update({
      LastPriceFetchDate: new Date(),
      Expired: true,
    });
  }

  static async CreateNewProductVintage(sp) {
    let expiredProduct = Object.assign({}, sp);
    expiredProduct.Id += "x" + sp.Year;
    expiredProduct.Expired = true;
    expiredProduct.Buyable = false;
    expiredProduct.Status = "Utgått";
    expiredProduct.Stores = [];
    expiredProduct.IsVintage = true;
    delete expiredProduct.StoreStock;

    firebase
      .firestore()
      .collection("Products")
      .doc(expiredProduct.Id)
      .set(expiredProduct);
  }

  static async GetIdsNotInDb(ids) {
    let idsNotFound = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];

      await firebase
        .firestore()
        .collection("Products")
        .doc(id)
        .get()
        .then(function (qs) {
          if (!qs.exists || qs.data().LastUpdated == undefined) {
            idsNotFound.push(id);
          }
        });
    }
    return idsNotFound;
  }

  static async GetProductsToBeUpdated() {
    let ids = [];
    let d = new Date();
    let today = d.getDate();
    d.setDate(d.getDate() - 3);
    await firebase
      .firestore()
      .collection("Products")
      .orderBy("LastPriceFetchDate", "asc")
      .where("LastPriceFetchDate", "<", today !== 1 ? d : new Date())
      .where("Expired", "==", false)
      .where("IsVintage", "==", false)
      .limit(today == 1 ? 30000 : 6000)
      .get()
      .then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            ids.push(p.id);
          });
        }
      });
    return ids;
  }

  static async GetProductsOnSale(lastUpdated) {
    let products = [];
    await firebase
      .firestore()
      .collection("Products")
      .where("LastUpdated", ">=", lastUpdated)
      .orderBy("LastUpdated")
      .where("PriceIsLowered", "==", true)
      .where("Buyable", "==", true)
      .get()
      .then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            p = p.data();
            if (p.Stock === undefined) {
              p.Stock = {
                Stores: [],
              };
            }
            if (!p.Id.includes("x")) {
              products.push(p);
            }
          });
        }
      });
    return products;
  }

  static async SetProductStores(productId, stores) {
    try {
      const productRef = firebase
        .firestore()
        .collection("Products")
        .doc(productId);

      if ((await productRef.get()) !== null) {
        productRef.update({ Stores: stores });
      }
    } catch (e) {
      console.log("Update failed for " + productId, e);
    }
  }

  static async UpdateProductRating(result) {
    var today = new Date();
    const productRef = firebase
      .firestore()
      .collection("Products")
      .doc(result.productId);
    try {
      await productRef.update({
        Rating: result.rating,
        RatingFetchDate: today,
        RatingComment: result.comment,
        RatingUrl: result.ratingUrl,
      });
    } catch (e) {
      console.log("Update failed for " + result.productId, e);
    }
  }

  static async GetProductsWithOldRating() {
    let products = [];
    let date = new Date();
    let datetime = date.setMonth(date.getMonth() - 6);
    await firebase
      .firestore()
      .collection("Products")
      .where("RatingFetchDate", "<", datetime)
      .orderBy("RatingFetchDate")
      .limit(350)
      .get()
      .then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            let product = p.data();
            if (!product.Id.includes("x")) {
              products.push(product);
            }
          });
        }
      });
    return products;
  }

  static async UpdateStores(stores) {
    const storesRef = firebase.firestore().collection("Stores").doc("1");
    storesRef.set({ StoreList: stores });
  }

  static async UpdateConstants(data, type) {
    const typeRef = firebase.firestore().collection("Constants").doc(type);
    typeRef.set({ [type]: data });
  }

  static async GetConstant(type) {
    const typeRef = firebase.firestore().collection("Constants").doc(type);
    let dataObject = typeRef.get();
    dataObject = (await dataObject).data();
    return dataObject[type];
  }

  static async GetUsers() {
    var users = [];
    var authUsers = [];
    await firebase
      .firestore()
      .collection("Users")
      .get()
      .then((qs) => {
        if (!qs.empty) {
          qs.forEach(async (userObject) => {
            let uid = userObject.id;
            let userData = userObject.data();

            if (userData.products === undefined) {
              userData.products = [];
            }
            if (userData.filters === undefined) {
              userData.filters = [];
            }
            userData.id = uid;
            if (userData.name) {
              users.push(userData);
            }
          });
        }
      })
      .catch((e) => console.log(e));

    for (const i in users) {
      let user = users[i];
      await firebase
        .auth()
        .getUser(user.id)
        .then(async (userRecord) => {
          user.email = userRecord.email;
          authUsers.push(user);
        })
        .catch((e) => console.log(e + " " + user.id));
    }
    return users;
  }
};
