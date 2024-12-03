const firebase = require("firebase-admin");
const sortArray = require("sort-array");
const VmpClient = require("./vmpClient");
require("firebase/firestore");
require("firebase/auth");

module.exports = class FirebaseClient {
  static async UpsertProduct(p) {
    let today = this.GetTodayTimeStamp();
    const productRef = firebase.firestore().collection("Products").doc(p.Id);

    if (p.PriceHistory == undefined) {
      p = this.SetPriceHistory(p);
    }
    p.LastPriceFetchDate = new Date();
    p.LastUpdated = today;
    p = this.CalculatePrices(p);
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

  static async UpdateProduct(db_batch, sp, new_p) {
    let today = this.GetTodayTimeStamp();
    const productRef = firebase
      .firestore()
      .collection("Products")
      .doc(new_p.Id);

    if (!sp) {
      return false;
    }

    if (db_batch)
      db_batch.update(productRef, { LastPriceFetchDate: new Date() });
    else productRef.update({ LastPriceFetchDate: new Date() });

    var newVintageCreated = false;
    if (
      new_p.Year &&
      sp.Year &&
      new_p.Year != "0000" &&
      sp.Year != "0000" &&
      sp.Year != new_p.Year &&
      !new_p.VintageComment?.includes("ikke egnet for lagring")
    ) {
      await this.CreateNewProductVintage(sp);
      // Resetting fiels that will be copied to vintage.
      new_p = this.SetPriceHistory(new_p);
      new_p.LastUpdated = today;
      new_p.PriceChange = 100;
      new_p.PriceIsLowered = false;
      newVintageCreated = true;
    } else if (sp.PriceHistory) {
      new_p.PriceHistory = sp.PriceHistory;
    } else {
      new_p = this.SetPriceHistory(new_p);
    }
    if (new_p.Price !== null || new_p.Price !== undefined) {
      new_p = this.CalculatePrices(new_p, sp.Alcohol);

      let ComparingPrice = sp.PriceHistory[sp.LastUpdated] ?? new_p.Price;
      let PriceChange = (new_p.Price / ComparingPrice) * 100;

      if (
        newVintageCreated === false &&
        PriceChange !== 100 &&
        (PriceChange <= 98 || PriceChange >= 102)
      ) {
        new_p.PriceIsLowered = PriceChange < 100;
        new_p.PriceChange = Math.round(PriceChange * 100) / 100;
        new_p.PriceHistory[today] = new_p.Price;
        new_p.LastUpdated = today;
      }
    }
    new_p.PriceHistorySorted = sortArray(Object.keys(new_p.PriceHistory), {
      order: "desc",
    });
    new_p.PriceChanges = new_p.PriceHistorySorted?.length || 0;
    if (db_batch) db_batch.update(productRef, { ...new_p });
    else productRef.update({ ...new_p });

    return true;
  }

  static CalculatePrices(p, alcohol) {
    p.LatestPrice = p.Price;
    p.Literprice = Math.ceil((p.Price / p.Volume) * 100);
    p.LiterPriceAlcohol = Math.ceil((100 / alcohol) * p.Literprice);
    return p;
  }

  static SetPriceHistory(p) {
    let today = this.GetTodayTimeStamp();
    p.PriceHistory = {
      [today]: p.Price,
    };
    p.PriceHistorySorted = [today];
    return p;
  }

  static async ExpireProduct(db_batch, id) {
    const productRef = firebase.firestore().collection("Products").doc(id);
    if (!(await productRef.get()).exists) {
      return;
    }
    db_batch.update(productRef, {
      LastPriceFetchDate: new Date(),
      Expired: true,
      Buyable: false,
      Stores: [],
      AvailableOnline: false,
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

    await firebase
      .firestore()
      .collection("Vintages")
      .doc(sp.Id)
      .collection("Vintages")
      .doc(expiredProduct.Id)
      .set(expiredProduct);
  }

  static async GetIdsNotInDb(ids) {
    let idsNotFound = [];
    const idsToIgnore = await FirebaseClient.GetConstant("ProductsToIgnore");
    const filteredIds = ids.filter((id) => !idsToIgnore.includes(id));
    return await firebase
      .firestore()
      .collection("Products")
      .get()
      .then((qs) => {
        var idsInDb = qs.docs.map((d) => d.id);
        return filteredIds.filter((id) => !idsInDb.includes(id));
      });
  }

  static async GetProductsToBeUpdated() {
    let products = [];
    let today = new Date().getDate();
    let yesterDay = new Date();
    yesterDay.setDate(yesterDay.getDate() - 1);

    if (this.IsLastDayOfMonth()) return products;

    await firebase
      .firestore()
      .collection("Products")
      .orderBy("LastPriceFetchDate", "asc")
      .where("LastPriceFetchDate", "<", yesterDay)
      .where("Expired", "==", false)
      .limit(today == 1 ? 35000 : 18000)
      .get()
      .then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            let data = p.data();
            data.Id = p.id;
            products.push(data);
          });
        }
      });

    await firebase
      .firestore()
      .collection("Products")
      .orderBy("LastPriceFetchDate", "asc")
      .where("LastPriceFetchDate", "<", yesterDay)
      .where("Buyable", "==", true)
      .where("Expired", "==", true)
      .limit(1000)
      .get()
      .then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            let data = p.data();
            data.Id = p.id;
            products.push(data);
          });
        }
      });

    await firebase
      .firestore()
      .collection("Products")
      .orderBy("LastPriceFetchDate", "asc")
      .where("LastPriceFetchDate", "<", yesterDay)
      .where("Buyable", "==", false)
      .where("Expired", "==", true)
      .limit(100)
      .get()
      .then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            let data = p.data();
            data.Id = p.id;
            products.push(data);
          });
        }
      });
    return products;
  }

  static IsLastDayOfMonth(date = new Date()) {
    const nextDay = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1
    );
    return nextDay.getDate() === 1;
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
            if (p.PriceHistory?.length > 1) {
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
            products.push(product);
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
