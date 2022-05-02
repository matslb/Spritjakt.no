const SortArray = require("sort-array");
const firebase = require("firebase-admin");
require("firebase/firestore");
require("firebase/auth");

module.exports = class FirebaseClient {

  static async UpdateProductPrice(p) {
    if (p.LatestPrice === null) {
      return;
    }
    let d = new Date();
    d.setHours(0 - d.getTimezoneOffset() / 60);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    var today = d.getTime();
    const productRef = firebase.firestore().collection("Products").doc(p.Id);
    const productDoc = await productRef.get();
    let sp = productDoc.data();

    if (sp === undefined) {
      sp = p;
      sp.PriceHistory = {
        [today]: sp.LatestPrice,
      };
      sp.PriceHistorySorted = [today];
      sp.LastUpdated = today;
      try {
        await productRef.set(sp);
      } catch (error) {
        console.log(error);
      }
    } else {

      if (p.Year != "0000" && !p.VintageComment?.includes("ikke egnet for lagring")) {
        if (sp.Year !== undefined && sp.Year != p.Year) {
          var expiredProduct = Object.assign({}, sp);
          expiredProduct.Expired = true;
          expiredProduct.Buyable = false;
          expiredProduct.ProductStatusSaleName = "Utgått";
          expiredProduct.Id += "x" + expiredProduct.Year;
          expiredProduct.Stores = [];
          expiredProduct.StoreStock = [];
          try {
            console.log("New vintage detected for product " + sp.Id + ". Creating new product " + expiredProduct.Id);
            await firebase.firestore().collection("Products").doc(expiredProduct.Id).set(expiredProduct);
            sp = p;
            sp.RatingFetchDate = 0;
            sp.PriceHistory = {
              [today]: sp.LatestPrice,
            };
            sp.PriceHistorySorted = [today];
            sp.LastUpdated = today;
          } catch (error) {
            console.log(error);
          }
        }
        else {
          sp.Year = p.Year;
        }
      }
      sp.ProductStatusSaleName = p.ProductStatusSaleName ? p.ProductStatusSaleName : "";
      sp.Types = p.Types;
      sp.Country = p.Country;
      if (sp.PriceHistory[sp.PriceHistorySorted[0]] == null) {
        sp.PriceHistory = {
          [today]: p.LatestPrice,
        };
      }
      sp.PriceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
        order: "desc",
      });
      delete sp.Stock;
      sp.Name = p.Name
      sp.Color = p.Color;
      sp.Smell = p.Smell;
      sp.Taste = p.Taste;
      sp.IsGoodFor = p.IsGoodFor;
      sp.Sweetness = p.Sweetness;
      sp.Fullness = p.Fullness;
      sp.Freshness = p.Freshness;
      sp.Sulfates = p.Sulfates;
      sp.Expired = p.Expired;
      sp.Buyable = p.Buyable;
      sp.RawMaterials = p.RawMaterials;
      sp.VintageComment = p.VintageComment;
      sp.LatestPrice = p.LatestPrice;
      let ComparingPrice = sp.PriceHistory[sp.PriceHistorySorted[0]];
      let LatestPrice = p.LatestPrice !== null ? p.LatestPrice : ComparingPrice;
      if (ComparingPrice === undefined) {
        ComparingPrice = LatestPrice;
      }
      if (ComparingPrice === null || ComparingPrice === undefined) {
        return;
      }

      let PriceChange = (LatestPrice / ComparingPrice) * 100;

      if (PriceChange !== 100) {
        if (PriceChange <= 98 || PriceChange >= 102) {
          sp.PriceIsLowered = PriceChange < 100;
          sp.PriceChange = Math.round(PriceChange * 100) / 100;
        } else {
          sp.PriceIsLowered = null;
          sp.PriceChange = 100;
        }
        sp.PriceHistory[today] = LatestPrice;
        sp.LastUpdated = today;
        sp.LatestPrice = LatestPrice;
        sp.PriceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
          order: "desc",
        });
        sp.PriceChanges = sp.PriceHistorySorted ? sp.PriceHistorySorted.length : 0;
      }
    }

    sp = this.HandleProductMeta(sp);
    try {
      console.log("Updating: " + sp.Id);
      await productRef.set(sp);
    } catch (error) {
      console.log(error);
    }
  }

  static HandleProductMeta(sp) {
    if (sp.Stores == undefined) {
      sp.Stores = [];
    }
    if (sp.ProductStatusSaleName === "") {
      if (!sp.Stores.includes("online")) {
        sp.Stores.push("online");
      }
    } else {
      sp.Stores = sp.Stores.filter(s => s !== "online");
    }
    if (sp.Stores?.length > 0 && sp.Alcohol > 0.7) {
      if (sp.PriceHistory[sp.PriceHistorySorted[1]]) {
        sp.PriceChange = Math.round((sp.LatestPrice / sp.PriceHistory[sp.PriceHistorySorted[1]] * 100) * 100) / 100;
      }
      sp.PriceChanges = sp.PriceHistorySorted ? sp.PriceHistorySorted.length : 0;
      sp.Literprice = Math.ceil(sp.LatestPrice / (sp.Volume * 100) * 100);
      sp.LiterPriceAlcohol = Math.ceil((100 / sp.Alcohol) * sp.Literprice);
    } else {
      delete sp.PriceChange;
      delete sp.PriceChanges;
      delete sp.LiterPriceAlcohol;
      delete sp.ComparingPrice;
      delete sp.PriceIsLowered;
      sp.Buyable = false;
    }

    return sp
  }

  static async SetPriceUpdateList(ids) {
    console.log("Updating " + ids.length + " product prices")
    await firebase.database().ref("/PricesToBeFetched/").set(ids);
  }

  static async SetStockUpdateList(ids) {
    await firebase.database().ref("/StocksToBeFetched/").set(ids);
  }

  static async GetProductIdsForStock() {
    let ids = [];

    let d = new Date();
    d.setDate(d.getDate() - 1);
    await firebase.firestore()
      .collection("Products")
      .where("StockFetchDate", "<", d)
      .where("Expired", "==", null)
      .orderBy("StockFetchDate", "asc")
      .limit(5000)
      .get().then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            ids.push(p.id);
          });
        }
      });

    let moreIds = await firebase.firestore()
      .collection("Products")
      .where("StockFetchDate", "<", d)
      .where("Buyable", "==", true)
      .where("Expired", "==", true)
      .orderBy("StockFetchDate", "asc")
      .limit(500)
      .get().then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            ids.push(p.id);
          });
        }
      });
    if (moreIds)
      ids = ids.concat(moreIds);

    return ids;
  }

  static async GetProductsOnSale(lastUpdated) {
    let products = [];
    await firebase.firestore()
      .collection("Products")
      .where("LastUpdated", ">=", lastUpdated)
      .orderBy("LastUpdated")
      .where("PriceIsLowered", "==", true)
      .get().then(function (qs) {
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

  static async UpdateProductStock(stock) {
    const productRef = firebase
      .firestore()
      .collection("Products")
      .doc(stock.productId);
    try {
      console.log("Updating Stock " + stock.productId);
      delete stock.productId;
      delete stock.stock;
      const productDoc = await productRef.get();
      let sp = productDoc.data();
      sp.Stores = [];
      sp.StoreStock = [];
      for (const store of stock.Stores) {
        if (store.stockInfo?.stockLevel)
          sp.StoreStock.push({
            store: store.pointOfService.id,
            stock: store.stockInfo.stockLevel
          });
        sp.Stores.push(store.pointOfService.id);
      }
      sp = this.HandleProductMeta(sp);
      sp.StockFetchDate = new Date();
      await productRef.set(sp);
    } catch (e) {
      console.log(e);
      console.log("Product not in database");
    }
  }

  static async UpdateProductRating(result) {
    if (result.rating == null) return;

    const productRef = firebase
      .firestore()
      .collection("Products")
      .doc(result.productId);
    try {
      await productRef.update(
        {
          Rating: result.rating,
          RatingFetchDate: Date.now(),
          RatingComment: result.comment,
          RatingUrl: result.ratingUrl
        });
    } catch (e) {
      console.log("Update failed for " + result.productId, e);
    }
  }

  static async GetProductsWithOldRating() {

    let products = [];
    let datetime = Date.now() - 15778800000; // 6 months
    await firebase.firestore()
      .collection("Products")
      .where("RatingFetchDate", "<", datetime)
      .orderBy("RatingFetchDate")
      .limit(350)
      .get().then(function (qs) {
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

  static async GetStores() {
    const storesRef = firebase.firestore().collection("Stores").doc("1");
    let storeObject = storesRef.get();
    storeObject = (await storeObject).data();
    return storeObject.StoreList;
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
    await firebase.firestore().collection("Users")
      .get().then((qs) => {
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
      }).catch(e => console.log(e));

    for (const i in users) {
      let user = users[i];
      await firebase.auth().getUser(user.id)
        .then(async (userRecord) => {
          user.email = userRecord.email;
          authUsers.push(user);
        }).catch(e => console.log(e + " " + user.id))
    }
    return users;
  }
};
