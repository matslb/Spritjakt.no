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
  static async FetchFreshProducts() {
    var today = new Date();
    let options = vmpOptions();
    options.uri += "products/v0/details-normal/";
    options.qs = {
      changedSince: today.toISOString().slice(0, 10),
      maxResults: 30000,
    };
    console.info(options);
    return await rp(options)
      .then(function (res) {
        var raw = res.filter(function (p) {
          return (
            p.classification.mainProductTypeId !== "8" &&
            p.prices[0] !== undefined
          ); // Gaveartikler og tilbehør
        });
        var items = [];

        raw.map((p) => items.push(CreateProduct(p)));

        console.info("Fetched products " + items.length + " from Vinmonopolet");
        return items;
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
  static async FetchStoreStock(productId) {
    let options = {
      uri: "https://www.vinmonopolet.no/api/products/" + productId + "/stock",
      qs: {
        pageSize: 1000,
        currentPage: 0,
        fields: "BASIC",
        latitude: 50.3,
        longitude: 10.2,
      },
      jar: true,
      json: true,
    };
    return await rp(options)
      .then(function (res) {
        return res === undefined ? [] : res.stores;
      })
      .catch(function (err) {
        console.error("Store stock fetch failed: " + err);
      });
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

function CreateProduct(rawProduct) {
  let d = new Date();
  d.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
  return {
    LastUpdated: d.getTime(),
    Id: rawProduct.basic.productId,
    Name: rawProduct.basic.productLongName,
    Volume: rawProduct.basic.volume,
    Alcohol: rawProduct.basic.alcoholContent,
    Country: rawProduct.origins.origin.country,
    Type: rawProduct.classification.mainProductTypeName,
    SubType: rawProduct.classification.subProductTypeName,
    Description: rawProduct.description,
    LatestPrice: rawProduct.prices[0].salesPrice,
    SearchWords: rawProduct.basic.productLongName.toLowerCase().split(" "),
    ProductStatusSaleName: rawProduct.basic.productStatusSaleName
  }
}

module.exports = VmpClient;
