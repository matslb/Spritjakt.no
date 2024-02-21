const axios = require("axios");
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");
const config = require("../configs/vmp.json");
const cookieJar = new tough.CookieJar();
var HTMLParser = require("node-html-parser");
const { HeaderGenerator, PRESETS } = require("header-generator");
const { XMLParser } = require("fast-xml-parser");
const ProductSearchParser = require("./Models/ProductSearchResult");
const { error } = require("firebase-functions/logger");
const parser = new XMLParser();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const firebase = require("firebase-admin");
const path = require("path");
const fs = require("fs");

require("firebase/firestore");

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
  static async FetchFreshProducts(start = 0) {
    var date = new Date();
    date.setDate(date.getDate() - 1);
    let options = vmpOptions();
    options.url += "products/v0/details-normal/";
    options.resolveWithFullResponse = true;
    options.params = {
      changedSince: "2000-01-01",
      start: start,
      maxResults: 60000,
    };
    return await axios(options)
      .then(function (res) {
        var raw = res.data;
        var items = [];
        raw.map((p) => {
          if (!items.includes(p.basic.productId)) {
            items.push(p.basic.productId);
          }
        });
        console.info("Fetched products " + items.length + " from Vinmonopolet");
        return {
          totalCount: parseInt(res.headers["x-total-count"]),
          products: items,
          error: false,
        };
      })
      .catch(function (err) {
        console.error("vmp fetch failed: " + err);
        return {
          totalCount: null,
          products: null,
          error: true,
        };
      });
  }

  static async GetNewProductList() {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    let totalResults = 1;
    let products = [];
    let page = 0;
    let errors = 0;
    while (products.length < totalResults && totalResults > 0 && errors < 3) {
      var headers = headerGenerator.getHeaders();
      delete headers["accept"];
      const options = {
        method: "get",
        url: `https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=24&searchType=product&currentPage=${page}&q=%3Arelevance%3AnewProducts%3Atrue`,
        jar: cookieJar,
        headers: headers,
        withCredentials: true,
      };
      products = products.concat(
        await axios(options)
          .then(async function (res) {
            totalResults =
              res.data.productSearchResult.pagination.totalResults || 0;
            let new_products = ProductSearchParser.GetProductsFromSearchResult(
              res.data
            );

            if (new_products.length > 0) {
              const productRef = firebase
                .firestore()
                .collection("Products")
                .doc(new_products[new_products.length - 1].Id);
              const productDoc = await productRef.get();
              if (productDoc.exists) {
                totalResults = 0;
                new_products = [];
              }
              return new_products;
            }
          })
          .catch(function (err) {
            errors++;
            return [];
          })
      );
      page++;
    }
    return products;
  }

  static async GetProductDetails(productId) {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"];
    const options = {
      method: "get",
      url: `https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=100&searchType=product&currentPage=0&q=${productId}:relevance`,
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    return await axios(options)
      .then(async function (res) {
        return {
          product: ProductSearchParser.GetProductFromSearchResult(
            productId,
            res.data
          ),
        };
      })
      .catch(function (err) {
        return { error: err };
      });
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
    delete headers["accept"];

    var options = {
      method: "get",
      url:
        "https://www.vinmonopolet.no/vmpws/v2/vmp/products/" +
        productId +
        "?fields=FULL",
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    return await axios(options)
      .then(async function (res) {
        if (
          parser.parse(res?.data).product?.main_category?.code ===
          "gaveartikler_og_tilbehør"
        ) {
          return { product: false };
        }

        let p = CreateProduct(res.data);
        if (p.LatestPrice === 0) return { product: false };

        return { product: p };
      })
      .catch(function (err) {
        return { error: err };
      });
  }

  static async FetchProductRating(productId, name) {
    let rating = null;
    let ratingComment = null;

    name = encodeURIComponent(name.replace(/(\d\d\d\d)/, ""));
    return await axios
      .get("https://www.aperitif.no/pollisten?query=" + name)
      .then(async function (res) {
        let pageRoot = HTMLParser.parse(res.data);
        let ratingHtml = pageRoot.querySelectorAll(
          ".product-list-element .group-2 .points .number"
        );
        let urlHtml = pageRoot.querySelectorAll(
          ".product-list-element .group-1  a"
        );
        let results = pageRoot.querySelectorAll(
          ".product-list-element .group-1  .detail .index"
        );
        let matchIndex = results.findIndex((e) =>
          e.innerText.includes(productId)
        );
        if (matchIndex == -1) {
          console.log("skipping");
          return {
            productId: productId,
            rating: null,
            comment: null,
            ratingUrl: null,
          };
        }

        let url =
          urlHtml.length > 0 ? urlHtml[matchIndex].attributes.href : null;
        rating = parseInt(ratingHtml[matchIndex].innerText);
        url = "https://www.aperitif.no/" + url;
        await axios.get(url).then(async function (res) {
          let pageRoot = HTMLParser.parse(res.data);
          let commentHtml = pageRoot.querySelectorAll("h2.conclusion");
          ratingComment =
            commentHtml.length > 0 ? commentHtml[0].innerText : null;
        });
        console.info("Successfully fetched product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
          comment: ratingComment,
          ratingUrl: url,
        };
      })
      .catch((err) => {
        console.error("Could not fetch product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
          comment: null,
          ratingUrl: null,
        };
      });
  }

  static async GetProductRatingFromVivino(productName) {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"];

    var options = {
      method: "get",
      url: `https://www.vivino.com/search/wines?q=${encodeURIComponent(
        productName
      )}`,
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    try {
      const response = await axios(options);
      const html = await response.data;
      const dom = new JSDOM(html);
      const document = dom.window.document;
      let result = null;

      const cards = document.querySelectorAll(".search-results-list .card");
      cards.forEach((card) => {
        const nameElement = card.querySelector(".wine-card__name a");
        const name = nameElement.textContent.trim();
        const averageRating = card.querySelector(".average__number")
          ? card.querySelector(".average__number").textContent.trim()
          : null;
        const url = nameElement.href
          ? `https://www.vivino.com/wines${
              nameElement.getAttribute("href").split("/wines")[1]
            }`
          : null;

        var parsedRating = Number.parseFloat(averageRating.replace(",", "."));

        if (
          name.toLowerCase() === productName.toLowerCase() &&
          !Number.isNaN(parsedRating)
        ) {
          result = {
            rating: parsedRating,
            url: url,
          };
          return false;
        }
      });

      if (result) {
        console.log(`Found match for ${productName}:`, result);
        return result;
      } else {
        console.log(`No exact match found for ${productName}`);
        return { error: "No exact match found" };
      }
    } catch (error) {
      console.error("Failed to get product rating from Vivino:", error);
      throw error;
    }
  }

  static async FetchAndStoreRatingsFromVivino(page = 1) {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"];
    let total = 0;
    let foundInPage = 0;
    var options = {
      method: "get",
      url: `https://www.vivino.com/webapi/explore/explore?country_code=FR&currency_code=EUR&grape_filter=varietal&min_rating=1&order_by=price&order=asc&price_range_max=500&price_range_min=0&wine_type_ids%5B%5D=1&wine_type_ids%5B%5D=2&wine_type_ids%5B%5D=3&wine_type_ids%5B%5D=24&wine_type_ids%5B%5D=7&wine_type_ids%5B%5D=4&language=en&page=${page}`,
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    try {
      const response = await axios(options);
      total = response.data.explore_vintage.records_matched;
      const vintages = response.data.explore_vintage.matches.map((match) => {
        return {
          id: match.vintage.id,
          name: match.vintage.name,
          seoName: match.vintage.seo_name,
          rating: match.vintage.statistics.ratings_average,
        };
      });
      foundInPage = vintages.length;
      process.stdout.write(
        `\rPage: ${page} - ${foundInPage * page} of ${total} products fetched`
      );
      const filePath = path.resolve(__dirname, "vivino.js");

      // Check if the file exists, if not, create an array structure
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify([]));
      }

      // Read existing data, append new data, and save
      fs.readFile(filePath, (err, data) => {
        if (err) throw err;
        const existingData = JSON.parse(data);
        const duplicate = existingData.find(
          (r) => r.id === vintages.find((v) => v.Id == r.id)
        );
        if (duplicate) throw "Found existing product in response :(";
        const updatedData = [...existingData, ...vintages];
        fs.writeFile(filePath, JSON.stringify(updatedData, null, 2), (err) => {
          if (err) throw err;
        });
      });
    } catch (error) {
      console.error("Failed to fetch or save data:", error);
    }
    return { productsLeft: total - foundInPage * page };
  }
}
function CreateProduct(productData) {
  let types = [];

  let type = productData.main_category.name;
  types.push(productData.main_category.name);

  if (productData.tags) {
    types = types.concat(productData.tags).map((t) => t.replaceAll(",", "."));
  }

  return {
    Id: productData.code,
    Name: productData.name,
    Volume: productData.volume ? productData.volume.value : null,
    Alcohol: productData.alcohol ? productData.alcohol.value : null,
    Sugar: productData.sugar ? productData.sugar : "",
    Acid: productData.acid ? productData.acid : "",
    Country: productData.main_country ? productData.main_country.name : null,
    Type: type,
    Types: types,
    RawMaterials: productData.raastoff || [],
    Color: productData.color || null,
    Smell: productData.smell || null,
    Taste: productData.taste || null,
    IsGoodFor: productData.isGoodFor || null,
    IsGoodForList: productData.isGoodFor?.map((x) => x.name) || [],
    Sweetness: productData.sweetness || null,
    Fullness: productData.fullness || null,
    Freshness: productData.freshness || null,
    Sulfates: productData.sulfates || null,
    Expired: productData.expired,
    Buyable: productData.buyable,
    Status: productData.status || null,
    AvailableOnline:
      productData.availability?.deliveryAvailability?.available || false,
    LatestPrice: productData.price.value || null,
    Price: productData.price.value || null,
    ProductStatusSaleName: "",
    Year: productData?.year || null,
    IsVintage: false,
    VintageComment: productData.matured || null,
    Stores:
      productData.availability?.deliveryAvailability?.available === true
        ? ["online"]
        : [],
  };
}
module.exports = VmpClient;
