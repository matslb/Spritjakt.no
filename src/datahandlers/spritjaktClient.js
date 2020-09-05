import rp from "request-promise";
import firebase from "firebase/app";
import "firebase/firestore";

const allTimeEarliestDate = new Date(1594166400000);
const td = new Date();
const allowedTimeSpans = {
  "7days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 7),
  "14days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 14),
  "30days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 30),
  "90days": new Date(td.getFullYear(), td.getMonth(), td.getDate() - 90),
};

class SpritjaktClient {

  static async FetchProducts(timeSpan) {

    if (allowedTimeSpans[timeSpan].getTime() > allTimeEarliestDate.getTime()) {
      timeSpan = allowedTimeSpans[timeSpan];
    } else {
      timeSpan = allTimeEarliestDate;
    }

    let products = [];
    await firebase.firestore()
      .collection("Products")
      .where("LastUpdated", ">=", timeSpan.getTime())
      .orderBy("LastUpdated")
      .get().then(function (qs) {
        if (!qs.empty) {
          qs.forEach((p) => {
            p = p.data();

            if (p.Id === "11443601") {
              let noe;
            }
            let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => (priceDate <= timeSpan.getTime() && priceDate !== p.LastUpdated));

            p.ComparingPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
            p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);

            if (p.SortingDiscount && p.SortingDiscount >= 101 || p.SortingDiscount <= 99) {
              products.push(p);
            }
          });
        }
      });
    return products;
  }
  static async SearchProducts(searchString) {
    let options = {
      uri:
        "https://europe-west1-spritjakt.cloudfunctions.net/productSearchAdvanced",
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
  static async FetchStores() {
    const storesRef = firebase.firestore().collection("Stores").doc("1");
    let storeObject = storesRef.get();
    storeObject = (await storeObject).data();
    return storeObject.StoreList;
  }

  static async registerEmail(email) {
    let options = {
      uri: "https://europe-west1-spritjakt.cloudfunctions.net/registerEmailHttp",
      qs: {
        email: email
      },
      json: true,
    };
    let res = await rp(options)
      .then(function (res) {
        return true;
      })
      .catch(function (err) {
        return false;
      });
    return res;
  }
  static async removeEmail(email) {
    let options = {
      uri: "https://europe-west1-spritjakt.cloudfunctions.net/removeEmailHttp",
      qs: {
        email: email
      },
      json: true,
    };
    let res = await rp(options)
      .then(function (res) {
        return true;
      })
      .catch(function (err) {
        return false;
      });
    return res;
  }

}

export default SpritjaktClient;
