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

  static async GetProductDetailsWithStock(
    productId,
    enrichWithContentDetails = false
  ) {
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
        var product = ProductSearchParser.GetProductFromSearchResult(
          productId,
          res.data
        );
        if (enrichWithContentDetails) {
          var productContentDetails = await VmpClient.GetProductContentDetails(
            productId
          );
          product.Alcohol = parseInt(productContentDetails.Alkohol);
          product.Acid = productContentDetails.Syre ?? null;
          product.Sugar = productContentDetails.Sukker ?? null;
        }

        return {
          product: product,
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
  static async GetProductContentDetails(productId) {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"];
    const propertyNames = ["Alkohol", "Sukker", "Syre"];
    var options = {
      method: "get",
      url: `https://www.vinmonopolet.no/p/${productId}`,
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    return await axios(options)
      .then(async function (res) {
        const html = res.data;

        // Use jsdom to parse the HTML
        const dom = new JSDOM(html);
        const document = dom.window.document;

        // Object to store the properties
        const properties = {};

        // Select the <ul> using partial matching of the class name
        const propertyList = document.querySelectorAll(".product__details ul");

        if (!propertyList) {
          console.error("Could not find the properties list");
          return null;
        }

        // Select all <li> elements inside the <ul> where the class starts with "content-item-"
        for (const prop of propertyList) {
          const propertyItems = prop.querySelectorAll("li");

          // Iterate through each <li> and extract the <strong> and <span> content
          propertyItems.forEach((item) => {
            const name = item.querySelector("strong")?.textContent.trim();
            const value = item.querySelector("span")?.textContent.trim();

            // Dynamically add properties based on the <strong> text
            if (name && value && propertyNames.includes(name)) {
              properties[name] = value.replace(/[#¤%]/g, "");
            }
          });
        }
        return properties;
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
      console.error("Failed to fetch or save data:");
    }
    return { productsLeft: total - foundInPage * page };
  }
}

module.exports = VmpClient;
