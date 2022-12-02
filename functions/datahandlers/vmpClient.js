const axios = require("axios");
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const config = require("../configs/vmp.json");
const cookieJar = new tough.CookieJar();
var HTMLParser = require('node-html-parser');
const { HeaderGenerator, PRESETS } = require('header-generator');
axiosCookieJarSupport(axios);

const vmpOptions = () => {
  return {
    url: config.url,
    headers: {
      "User-Agent": "Request-Promise",
      "Ocp-Apim-Subscription-Key": config.apiKey,
    },
    json: true, // Automatically parses the JSON string in the response
  };
};
class VmpClient {
  static async FetchFreshProducts(start) {
    var date = new Date();
    date.setDate(date.getDate() - 1);
    let options = vmpOptions();
    options.url += "products/v0/details-normal/";
    options.resolveWithFullResponse = true;
    options.params = {
      changedSince: "2000-01-01",
      start: start,
      maxResults: 10000,
    };
    return await axios(options)
      .then(function (res) {
        var raw = res.data;
        var items = [];
        raw.map((p) => {
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
        return {
          totalCount: null,
          products: null,
          error: true
        };
      });
  }

  static async FetchStoreStock(productId, stores = []) {
    let storeStocks = [];
    let expectedResults = 1;
    let fail = false;
    let tries = 0;
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);

    while (fail == false && storeStocks.length < expectedResults && stores.length > 0 && tries < 40) {
      var headers = headerGenerator.getHeaders();
      let index = Math.floor(Math.random() * stores.length);
      let options = {
        method: "get",
        url: "https://www.vinmonopolet.no/api/products/" + productId + "/stock",
        params: {
          pageSize: 1000,
          currentPage: 0,
          fields: "BASIC",
          latitude: stores[index].address.gpsCoord.split(";")[0],
          longitude: stores[index].address.gpsCoord.split(";")[1],
        },
        headers: headers,
        jar: cookieJar,
        withCredentials: true
      };

      stores.splice(index, 1);
      tries++;
      await axios(options)
        .then(async function (res) {
          res.data.stores.forEach(newStore => {
            if (!storeStocks.some(oldStore => oldStore.pointOfService.id === newStore.pointOfService.id)) {
              delete newStore.pointOfService.address;
              delete newStore.pointOfService.formattedDistance;
              delete newStore.pointOfService.geoPoint;
              storeStocks.push(newStore);
              stores = stores.filter(s => s.storeId !== newStore.pointOfService.id);
            }
          });
          expectedResults = res.data.pagination.totalResults;
        })
        .catch(function (err) {
          console.log("Store stock fetch failed: " + err);
          fail = true;
        });
      if (expectedResults == 1 && storeStocks.length == 0) {
        fail = true;
      }
      await new Promise(r => setTimeout(r, (Math.random() * 5000) + 1000));
    }
    if (fail) {
      return { failed: fail, statusCode: 429, stocks: null };
    }

    console.log("Expected: " + expectedResults);
    console.log("Retrieved: " + storeStocks.length);
    console.log("tries: " + tries);

    return { failed: fail, statusCode: 200, stocks: storeStocks };
  }

  static async FetchStores() {
    let options = vmpOptions();
    options.url += "stores/v0/details";
    return await axios(options)
      .then(function (res) {
        let stores = [];
        res.data.map((s) => {
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

  static async FetchProductPrice(productId) {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();

    var options = {
      method: "get",
      url: "https://www.vinmonopolet.no/api/products/" + productId + "?fields=FULL",
      jar: cookieJar,
      headers: { 'User-Agent': useragent },
      withCredentials: true,
    };
    return await axios(options).then(async function (res) {

      if (res?.data?.main_category?.code === "gaveartikler_og_tilbehør") {
        return { product: false };
      }
      let p = CreateProduct(res.data);
      return { product: p };
    })
      .catch(function (err) {
        console.error("Could not fetch price of product " + productId + ": " + err);
        useragent = randomUseragent.getRandom();
        return { error: true };
      });
  }

  static async FetchProductRating(productId, name) {
    let rating = null;
    let ratingComment = null;

    name = encodeURIComponent(name.replace(/(\d\d\d\d)/, ""));
    return await axios.get("https://www.aperitif.no/pollisten?query=" + name)
      .then(async function (res) {
        let pageRoot = HTMLParser.parse(res.data);
        let ratingHtml = pageRoot.querySelectorAll('.product-list-element .group-2 .points .number');
        let urlHtml = pageRoot.querySelectorAll('.product-list-element .group-1  a');
        let results = pageRoot.querySelectorAll('.product-list-element .group-1  .detail .index');
        let matchIndex = results.findIndex(e => e.innerText.includes(productId));
        if (matchIndex == -1) {
          console.log("skipping");
          return {
            productId: productId,
            rating: null,
            comment: null,
            ratingUrl: null
          };
        }

        let url = urlHtml.length > 0 ? urlHtml[matchIndex].attributes.href : null;
        rating = parseInt(ratingHtml[matchIndex].innerText);
        url = "https://www.aperitif.no/" + url;
        await axios.get(url)
          .then(async function (res) {
            let pageRoot = HTMLParser.parse(res.data);
            let commentHtml = pageRoot.querySelectorAll('h2.conclusion');
            ratingComment = commentHtml.length > 0 ? commentHtml[0].innerText : null;
          })
        console.info("Successfully fetched product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
          comment: ratingComment,
          ratingUrl: url
        };
      })
      .catch((err) => {
        console.error("Could not fetch product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
          comment: null,
          ratingUrl: null
        };
      });
  }

}

function CreateProduct(productData) {
  let type = productData.main_category.name;
  if (!["Rødvin", "Hvitvin", "Musserende vin", "Øl", "Rosévin", "Perlende vin"].includes(type)) {
    type = productData.main_sub_category ? productData.main_sub_category.name : productData.main_sub_sub_category ? productData.main_sub_sub_category.name : type;
  }

  let types = [];
  if (productData.tags) {
    types = productData.tags;
  }
  types.push(type.split(",")[0]);

  return {
    Id: productData.code,
    Name: productData.name,
    Volume: productData.volume ? productData.volume.value : null,
    Alcohol: productData.alcohol ? productData.alcohol.value : null,
    Sugar: productData.sugar ? productData.sugar : "",
    Acid: productData.acid ? productData.acid : "",
    Country: productData.main_country ? productData.main_country.name : null,
    Types: types,
    RawMaterials: productData.raastoff || [],
    Color: productData.color || null,
    Smell: productData.smell || null,
    Taste: productData.taste || null,
    IsGoodFor: productData.isGoodFor || null,
    Sweetness: productData.sweetness || null,
    Fullness: productData.fullness || null,
    Freshness: productData.freshness || null,
    Sulfates: productData.sulfates || null,
    Expired: productData.expired || null,
    Buyable: productData.buyable || null,
    LatestPrice: productData.price ? productData.price.value : null,
    ProductStatusSaleName: productData.availability.deliveryAvailability.available ? "" : productData.availability.deliveryAvailability.mainText.split(": ")[1],
    Stores: productData.availability.deliveryAvailability.available ? ["online"] : [],
    Year: productData.year || null,
    VintageComment: productData.matured || null
  }
}

module.exports = VmpClient;
