const SortArray = require("sort-array");
const firebase = require("firebase-admin");
const { user } = require("firebase-functions/lib/providers/auth");
require("firebase/firestore");
require("firebase/auth");

const allTimeEarliestDate = new Date(1594166400000);

module.exports = class FirebaseClient {

  static async UpdateProductPrices(updatedProducts) {
    let d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(22);
    d.setMinutes(0);
    d.setSeconds(0);
    d.setMilliseconds(0);

    var today = d.getTime();

    console.log("Products to update: " + updatedProducts.length);
    let statusReport = {
      time: new Date(),
      total: updatedProducts.length,
      priceChanged: 0,
      created: 0
    }

    for (let i = 0; i < updatedProducts.length; i++) {
      const p = updatedProducts[i];

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
          await productRef.set(this.PrepProduct(sp));
          statusReport.created++;
        } catch (error) {
          console.log(error);
        }
      } else {
        sp.ProductStatusSaleName = p.ProductStatusSaleName;
        sp.SearchWords = p.SearchWords;
        sp.Description = p.Description;
        sp.ManufacturerName = p.ManufacturerName;
        sp.Type = p.Type;
        sp.PriceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
          order: "desc",
        });
        let LatestPrice = p.LatestPrice;
        let ComparingPrice = sp.PriceHistory[sp.PriceHistorySorted[0]];
        if (ComparingPrice === undefined) {
          ComparingPrice = LatestPrice;
        }

        let SortingDiscount = (LatestPrice / ComparingPrice) * 100;

        if (SortingDiscount !== 100) {

          if (SortingDiscount <= 98 || SortingDiscount >= 102) {
            sp.PriceIsLowered = SortingDiscount < 100;
            statusReport.priceChanged++;
          } else {
            sp.PriceIsLowered = null;
          }

          sp.PriceHistory[today] = LatestPrice;
          sp.LastUpdated = today;
          sp.LatestPrice = LatestPrice;
          sp.PriceHistorySorted = SortArray(Object.keys(sp.PriceHistory), {
            order: "desc",
          });
        }

        try {
          await productRef.update(this.PrepProduct(sp));
          console.log(sp.Id);
        } catch (error) {
          console.log(error);
        }
      }
    }
    this.writeRealtimeDataSection(statusReport, "/productUpdateReport");

  }

  static PrepProduct(p) {

    if (p.SubType && p.SubType.includes("Alkoholfri")) {
      p.SubType = "Alkoholfritt";
    }
    if (p.SubType === undefined) {
      p.SubType = p.Type;
    }

    p.SubType = p.SubType.split(",")[0];

    if (p.Stock === undefined) {
      p.Stock = {
        Stores: [],
      };
    }
    if (p.Stock.Stores === undefined) {
      p.Stock.stock = p.Stock.Stock;
      delete p.Stock.Stock;
      p.Stock.Stores = [];
    }
    return p;
  }

  static async ProductSearchAdvanced(searchStrings) {
    let productRef = firebase
      .firestore()
      .collection("Products")
      .where("SearchWords", "array-contains-any", searchStrings)
      .orderBy("Name");
    let snapshot = await productRef.get();
    let products = [];
    if (!snapshot.empty) {
      snapshot.forEach((p) => {
        products.push(p.data());
      });
    }
    return products;
  }

  static async FetchLastWriteTime() {
    return firebase
      .database()
      .ref("/lastProductWriteTime")
      .once("value")
      .then(function (snapshot) {
        return snapshot.val();
      });
  }

  static async writeRealtimeDataSection(data, section) {
    let sectionRef = firebase.database().ref(section);
    sectionRef.set(data);
  }

  static async SetStockUpdateList(Stocks, addOnSaleProductsIfMissing = false) {
    if (addOnSaleProductsIfMissing) {
      let d = new Date();
      if (d.getMonth() === 0) {
        d.setFullYear(d.getFullYear() - 1);
        d.setMonth(11);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      var products = await this.GetProductsOnSale(d.getTime());
      products.map((p) => {
        if (!Stocks.find((s) => s.productId === p.Id)) {
          Stocks.unshift({ productId: p.Id });
        }
      });
    }
    firebase.database().ref("/StocksToBeFetched/").set(Stocks);
  }

  static async GetProductsOnSale(lastUpdated) {
    let products = [];
    await firebase.firestore()
      .collection("Products")
      .where("LastUpdated", ">=", lastUpdated)
      .orderBy("LastUpdated")
      .get().then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            products.push(p.data());
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
      await productRef.update({ Stock: stock });
    } catch (e) {
      console.log("Product not in database");
    }
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

  static async getConstant(type) {
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
        }).catch(e => console.log(e))
    }

    return users;
  }

  static async RegisterUser(email) {
    let result = false;
    await firebase.firestore().collection("Users").add({
      Email: email
    })
      .then(function (docRef) {
        console.log("email added with ID: ", docRef.id);
        result = true;
      })
      .catch(function (error) {
        console.error("could not add email: ", error);
      });
    let emails = await this.GetEmails();
    this.writeRealtimeDataSection(emails.length, "/NewsletterStats");
    return result;
  }

  static async RemoveUser(email) {
    var result = true;
    await firebase.firestore().collection("Users").where("Email", "==", email)
      .get()
      .then(function (querySnapshot) {
        querySnapshot.forEach(async function (doc) {
          await firebase.firestore().collection("Users").doc(doc.id).delete();
        })
      }).catch(error => {
        console.log("Error removing user: ", error);
        result = false;
      });
    let emails = await this.GetEmails();
    this.writeRealtimeDataSection(emails.length, "/NewsletterStats");
    return result;
  }

};