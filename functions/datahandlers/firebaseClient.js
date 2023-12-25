const SortArray = require("sort-array");
const firebase = require("firebase-admin");
const sortArray = require("sort-array");
require("firebase/firestore");
require("firebase/auth");

module.exports = class FirebaseClient {

  static async UpdateProductPrice(p) {

    let d = new Date();
    d.setHours(0 - d.getTimezoneOffset() / 60);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);
    var today = d.getTime();
    var lastPriceFetchDate = new Date();
    const productRef = firebase.firestore().collection("Products").doc(p.Id);
    const productDoc = await productRef.get();
    let sp = productDoc.data();

    if (sp === undefined) {

      sp = p;
      if (p.Buyable == false) {
        sp.PriceHistory = {
          [today]: sp.LatestPrice,
        };
        sp.PriceHistorySorted = [today];
      }
      sp.LastPriceFetchDate = lastPriceFetchDate;
      sp.LastUpdated = today;
      try {
        await productRef.set(sp);
      } catch (error) {
        console.log(error);
      }
    } else {

      if (p.Year != "0000" && !p.VintageComment?.includes("ikke egnet for lagring")) {
        if (sp.Year !== undefined && sp.Year != p.Year) {
          var oldYear = sp.Year;
          var newYear = p.Year;
          var expiredProduct = Object.assign({}, sp);
          expiredProduct.Id += "x" + oldYear;
          expiredProduct.Expired = true;
          expiredProduct.Buyable = false;
          expiredProduct.ProductStatusSaleName = "Utgått";
          expiredProduct.Stores = [];
          expiredProduct.StoreStock = [];
          try {
            console.log("New vintage detected for product " + sp.Id + ". Creating new product " + expiredProduct.Id);
            firebase.firestore().collection("Products").doc(expiredProduct.Id).set(expiredProduct);
            // if vintage has already been created prior to this, its fetched and used as a base for pricehistory
            const existingVintageRef = firebase.firestore().collection("Products").doc(sp.Id += "x" + newYear);
            if ((await existingVintageRef.get()).exists) {
              sp = Object.assign({}, (await existingVintageRef.get())?.data());
              sp.Id = p.Id;
              existingVintageRef.delete();
            } else {
              sp = p;
              sp.RatingFetchDate = 0;
              sp.PriceHistory = {
                [today]: sp.LatestPrice,
              };
              sp.PriceHistorySorted = [today];
              sp.LastPriceFetchDate = lastPriceFetchDate;
            }
          } catch (error) {
            console.log(error);
          }
        }
        else {
          sp.Year = p.Year;
        }
      }
      if (sp.PriceHistory == undefined && p.LatestPrice != null) {
        sp.PriceHistory = {
          [today]: p.LatestPrice,
        };
        sp.PriceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
          order: "desc",
        });
      }

      p.PriceHistory = sp.PriceHistory; 
      p.PriceHistorySorted = sp.PriceHistorySorted; 
     
      let ComparingPrice = p.PriceHistory == undefined ? p.LatestPrice : p.PriceHistory[p.PriceHistorySorted[0]];
      let LatestPrice = p.LatestPrice !== null ? p.LatestPrice : ComparingPrice;
      if (ComparingPrice === undefined) {
        ComparingPrice = LatestPrice;
      }
      if (ComparingPrice === null || ComparingPrice === undefined) {
        p = this.HandleProductMeta(p);
        try {
          console.log("Updating: " + p.Id);
          await productRef.set(p);
          return;
        } catch (error) {
          console.log(error);
        }
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
      if (sp.PriceHistory != undefined && sp.PriceHistorySorted.length >= 1 && sp.PriceHistory[sp.PriceHistorySorted[1]]) {
        sp.PriceChange = Math.round((sp.LatestPrice / sp.PriceHistory[sp.PriceHistorySorted[1]] * 100) * 100) / 100;
      }
      sp.PriceChanges = sp.PriceHistorySorted ? sp.PriceHistorySorted.length : 0;
      sp.Literprice = Math.ceil(sp.LatestPrice / (sp.Volume) * 100);
      sp.LiterPriceAlcohol = Math.ceil((100 / sp.Alcohol) * sp.Literprice);
      sp.IsGoodForList = sp.IsGoodFor != undefined ? sp.IsGoodFor?.map(x => x.name) : [];
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

  static async GetIdsNotInDb(ids) {
    let idsNotFound = [];
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      
      await firebase.firestore()
      .collection("Products")
      .doc(id)
      .get().then(function (qs) {
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
    d.setDate(d.getDate() - 3);
    await firebase.firestore()
      .collection("Products")
      .orderBy("LastPriceFetchDate", "asc")
      .where("LastPriceFetchDate", "<", d)
      .limit(5000)
      .get().then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            if (!p.id.includes("x")) {
              ids.push(p.id);
            }
          });
        }
      });
    console.log("Fetching " + ids.length + " product Ids");
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

  static async SetProductStores(productId, stores){
    try {
      const productRef = firebase
        .firestore()
        .collection("Products")
        .doc(productId);
      
        if((await productRef.get() != null)){
          productRef.update({Stores: stores});
        }
    }
    catch (e) {
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
      await productRef.update(
        {
          Rating: result.rating,
          RatingFetchDate: today,
          RatingComment: result.comment,
          RatingUrl: result.ratingUrl
        });
    } catch (e) {
      console.log("Update failed for " + result.productId, e);
    }
  }

  static async GetProductsWithOldRating() {
    let products = [];
    let date = new Date();
    let datetime = date.setMonth(date.getMonth() - 6);
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
