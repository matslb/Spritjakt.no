const rp = require("request-promise");
const config = require("../configs/vmp.json");
const vmpOptions = () => {
  return {
    uri: config.url,
    headers: {
      "User-Agent": "Request-Promise",
      "Ocp-Apim-Subscription-Key": config.apiKey,
    },
    json: true, // Automatically parses the JSON string in the response
  };
};
class VmpClient {
  static async FetchFreshProducts(start) {
    var today = new Date();
    let options = vmpOptions();
    options.uri += "products/v0/details-normal/";
    options.resolveWithFullResponse = true;
    options.qs = {
      changedSince: today.toISOString().slice(0, 10),
      start: start,
      maxResults: 5000,
    };
    return await rp(options)
      .then(function (res) {
        var raw = res.body.filter(function (p) {
          return (
            p.classification.mainProductTypeId !== "8" &&
            p.prices[0] !== undefined
          ); // Gaveartikler og tilbehør
        });
        var items = [];
        raw.foreach((p) => {
          if (!items.includes(p.basic.productId)) {
            items.push(p.basic.productId)
          }
        });
        console.info("Fetched products " + items.length + " from Vinmonopolet");
        return {
          totalCount: parseInt(res.headers["x-total-count"]),
          products: items,
          error: false
        };
      })
      .catch(function (err) {
        console.error("vmp fetch failed: " + err);
      });
  }

  static async FetchFreshStocks(start) {
    var today = new Date();
    let options = vmpOptions();

    options.uri += "products/v0/accumulated-stock/";
    options.resolveWithFullResponse = true;
    options.qs = {
      maxResults: 5000,
      changedSince: today.toISOString().slice(0, 10),
      start: start,
    };
    return await rp(options)
      .then(function (res) {
        var items = [];
        for (let i = 0; i < res.body.length; i++) {
          const p = res.body[i];
          delete p.numberOfStoresWithStock;
          delete p.updatedDate;
          delete p.updatedTime;
          items.push(p);
        }
        return {
          totalCount: parseInt(res.headers["x-total-count"]),
          stocks: items,
          error: false
        };
      })
      .catch(function (err) {
        console.error("vmp fetch failed: " + err);
        return { totalCount: 0, stocks: [], error: true };
      });
  }

  static async FetchStoreStock(productId, stores = []) {
    let storeStocks = [];
    let expectedResults = 1;
    let fail = false;
    let tries = 0;
    while (storeStocks.length < expectedResults && stores.length > 0 && tries < 50) {
      let options = {
        uri: "https://www.vinmonopolet.no/api/products/" + productId + "/stock",
        qs: {
          pageSize: 1000,
          currentPage: 0,
          fields: "BASIC",
          latitude: stores[0].address.gpsCoord.split(";")[0],
          longitude: stores[0].address.gpsCoord.split(";")[1],
        },
        jar: true,
        json: true
      };
      stores.shift();
      tries++;
      await rp(options)
        .then(async function (res) {
          res.stores.forEach(newStore => {
            if (!storeStocks.some(oldStore => oldStore.pointOfService.id === newStore.pointOfService.id)) {
              delete newStore.pointOfService.address;
              delete newStore.pointOfService.formattedDistance;
              delete newStore.pointOfService.geoPoint;
              storeStocks.push(newStore);
              stores = stores.filter(s => s.storeId !== newStore.pointOfService.id);
            }
          });
          expectedResults = res.pagination.totalResults;
        })
        .catch(function (err) {
          console.error("Store stock fetch failed: " + err);
          expectedResults = 0;
          fail = true;
        });
    }
    console.log("Expected: " + expectedResults);
    console.log("Retrieved: " + storeStocks.length);
    console.log("tries: " + tries);
    if (fail) {
      return null;
    }
    return storeStocks;
  }

  static async FetchStores() {
    let options = vmpOptions();
    options.uri += "stores/v0/details";
    return await rp(options)
      .then(function (res) {
        let stores = [];
        res.map((s) => {
          stores.push({
            storeId: s.storeId,
            storeName: s.storeName,
            address: s.address,
          });
        });
        return stores;
      })
      .catch(function (err) {
        console.error("Store failed: " + err);
      });
  }
}

async function FetchProductPrice(productId) {

  await axios.get("https://www.vinmonopolet.no/api/products/" + productId + "?fields=FULL")
    .then(async function (res) {
      return CreateProduct(res.data);
    })
    .catch(function (err) {
      console.error("Could not fetch price: " + err);
    });
}

function CreateProduct(productData) {
  return {
    Id: productData.code,
    Name: productData.name,
    Volume: productData.volume.value,
    Alcohol: productData.alcohol.value,
    Sugar: productData.sugar,
    Acid: productData.acid,
    Country: productData.main_country.name,
    Type: productData.main_category,
    SubType: productData.main_category,
    Producer: productData.main_producer,
    Description: {
      characteristics: {
        color: productData.color,
        odour: productData.smell,
        taste: productData.taste
      }
    },
    LatestPrice: productData.price.value,
    SearchWords: productData.name.toLowerCase().split(" "),
    ProductStatusSaleName: productData.availability.deliveryAvailability.mainText
  }
}


module.exports = VmpClient;
