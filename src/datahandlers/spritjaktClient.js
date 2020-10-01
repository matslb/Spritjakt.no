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

              let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => (priceDate <= startPoint && parseInt(priceDate) !== parseInt(p.LastUpdated)));

              p.ComparingPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
              p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);

              if (p.SortingDiscount && (p.SortingDiscount >= 101 || p.SortingDiscount <= 99) && !this.loadedProducts.find(lp => lp.Id === p.Id)) {
                this.loadedProducts.push(p);
              }
            });
          }
        });
    } else {
      returnProducts.forEach(p => {
        let priceHistorySortedAndFiltered = p.PriceHistorySorted.filter(priceDate => (priceDate <= startPoint && priceDate !== p.LastUpdated));
        p.ComparingPrice = p.PriceHistory[priceHistorySortedAndFiltered[0]];
        p.SortingDiscount = (p.LatestPrice / p.ComparingPrice * 100);
      });
    }
    returnProducts = this.loadedProducts.filter(p => p.LastUpdated > startPoint);

    return returnProducts
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

  static async registerEmail(email) {
    let options = {
      uri: "https://europe-west1-spritjakt.cloudfunctions.net/registerEmail",
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
      uri: "https://europe-west1-spritjakt.cloudfunctions.net/removeEmail",
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
