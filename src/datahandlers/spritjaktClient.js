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

  constructor() {
    this.usedTimeSpans = [];
    this.loadedProducts = [];
  }

  async FetchProducts(startPointLabel) {

    if (allowedTimeSpans[startPointLabel].getTime() > allTimeEarliestDate.getTime()) {
      var startPoint = allowedTimeSpans[startPointLabel].getTime() - (2 * 60 * 60 * 1000);
    } else {
      var startPoint = allTimeEarliestDate.getTime();
    }
    if (!this.usedTimeSpans.includes(startPointLabel)) {
      let endAtPoint = Date.now();
      Object.keys(allowedTimeSpans).map(ts => {
        if (allowedTimeSpans[ts] >= allowedTimeSpans[startPointLabel]) {
          if (!this.usedTimeSpans.includes(ts)) {
            this.usedTimeSpans.push(ts);
          } else {
            endAtPoint = allowedTimeSpans[ts].getTime();
          }
        }
      });

      await firebase.firestore()
        .collection("Products")
        .where("LastUpdated", ">=", startPoint)
        .orderBy("LastUpdated")
        .endBefore(endAtPoint)
        .get()
        .then((qs) => {
          if (!qs.empty) {
            qs.forEach((p) => {
              p = p.data();

              let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => (priceDate <= startPoint && priceDate !== p.LastUpdated));

              p.ComparingPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
              p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);

              if (p.SortingDiscount && (p.SortingDiscount >= 101 || p.SortingDiscount <= 99) && !this.loadedProducts.find(lp => lp.Id === p.Id)) {
                this.loadedProducts.push(p);
              }
            });
          }
        });
    }

    return this.loadedProducts.filter(p => p.LastUpdated > startPoint);
  }

  async SearchProducts(searchString) {
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
  async FetchStores() {
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
