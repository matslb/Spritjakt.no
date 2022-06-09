const axios = require("axios");
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const config = require("../configs/vmp.json");
const cookieJar = new tough.CookieJar();
var HTMLParser = require('node-html-parser');
const vintageUrl = "https://www.winemag.com/wine-vintage-chart/";

axiosCookieJarSupport(axios);

const mappings = {
  colorcodes: {
    red: "hold",
    teal: "pre-peak",
    green: "ready",
    blue: "past-peak",
    gray: "decline",
    othergray: "no-data"
  }
}

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
      maxResults: 5000,
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
    while (storeStocks.length < expectedResults && stores.length > 0 && tries < 50) {
      let options = {
        method: "get",
        url: "https://www.vinmonopolet.no/api/products/" + productId + "/stock",
        params: {
          pageSize: 1000,
          currentPage: 0,
          fields: "BASIC",
          latitude: stores[0].address.gpsCoord.split(";")[0],
          longitude: stores[0].address.gpsCoord.split(";")[1],
        },
        jar: cookieJar,
        withCredentials: true
      };
      stores.shift();
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

    var options = {
      method: "get",
      url: "https://www.vinmonopolet.no/api/products/" + productId + "?fields=FULL",
      jar: cookieJar,
      withCredentials: true,
    };
    return await axios(options).then(async function (res) {

      if (res.data.main_category.code === "gaveartikler_og_tilbehør") {
        return null;
      }
      let p = CreateProduct(res.data);
      return p;
    })
      .catch(function (err) {
        console.error("Could not fetch price of product " + productId + ": " + err);
        return null;
      });
  }

  static async FetchProductRating(productId, name) {
    let rating = null;
    let ratingComment = null;
    let ratingUrl = null;

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
      .catch(function (err) {
        console.error("Could not fetch product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
          comment: null,
          ratingUrl: null
        };
      });
  }

  static async FetchVintageChart() {
    var dataRows = [];
    await axios.get(vintageUrl)
      .then((res) => {
        let pageRoot = HTMLParser.parse(res.data);
        let countries = pageRoot.querySelectorAll('.chart-title');
        for (const countryHtml of countries) {
          console.log(countryHtml.innerText);
          let country = countryHtml.innerText;
          let countryTable = pageRoot.querySelector('#' + country.toLowerCase().replace(" ", "-") + '-vintage-chart');
          let tableRows = countryTable.querySelectorAll("tbody tr:not(.region-holder)");
          let isGrapeType = countryTable.querySelector("thead tr .index-2").innerText == "Wine Variety";

          let lastRegion = "undefined";
          for (const tableRow of tableRows) {
            let regions = tableRow.querySelector(".index-1").innerText.trim() != "" ? tableRow.querySelector(".index-1").innerText : lastRegion;
            for (const currentRegion of regions.split("/")) {
              if (currentRegion == "Port") continue;
              lastRegion = currentRegion;

              let regionOrType = tableRow.querySelector(".index-2").innerText;
              let type = "";
              if (regionOrType.toLowerCase().includes("white")) {
                type = "white"
              }
              if (regionOrType.toLowerCase().includes("red")) {
                type = "red"
              }

              let typeGrapeOrDistricts = regionOrType.split("(")[0].split("/").filter(s => !["white)", "red)"].includes(s));

              for (const typeGrapeOrDistrict of typeGrapeOrDistricts) {
                for (const cellData of tableRow.querySelectorAll("td.year-rating")) {
                  let year = cellData.getAttribute("data-year");
                  let vintageState = mappings.colorcodes[cellData.getAttribute("data-color").toLowerCase()];
                  if (vintageState == mappings.colorcodes.othergray) continue;
                  let row = {
                    year: parseInt(year),
                    vintageState: vintageState,
                    region: currentRegion.trim() != "Table Wines" ? currentRegion.trim() : null,
                    sweet: typeGrapeOrDistrict.toLowerCase().includes("sweet"),
                    dry: typeGrapeOrDistrict.toLowerCase().includes("dry"),
                    district: !isGrapeType && !["Whites", "Reds", "Dry Whites", "Sweet Wines", "Sweet Whites", "Dry Reds", "Sweet Reds"].includes(typeGrapeOrDistrict) && typeGrapeOrDistrict.length > 0 ? typeGrapeOrDistrict.trim() : null,
                    type: ["white", "red"].includes(type) ? type : null,
                    grape: isGrapeType && !["white", "red"].includes(type) ? typeGrapeOrDistrict.trim() : null,
                    rating: parseInt(cellData.innerText),
                    country: country.trim()
                  };
                  dataRows.push(row);
                }
              }
            }
          }
        }
      });
    return dataRows;
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
