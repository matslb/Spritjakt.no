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
  static async GetProductsFromSearch(url, stopOnKnownProduct = false) {
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
        url: `${url}&currentPage=${page}`,
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

            if (new_products.length > 0 && stopOnKnownProduct == true) {
              const productRef = firebase
                .firestore()
                .collection("Products")
                .doc(new_products[new_products.length - 1].Id);
              const productDoc = await productRef.get();
              if (productDoc.exists) {
                totalResults = 0;
              }
            }
            return new_products;
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

  static async GetNewProductList() {
    return await this.GetProductsFromSearch(
      "https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=24&searchType=product&q=%3Arelevance%3AnewProducts%3Atrue",
      true
    );
  }

  static async GetAllProducts() {
    return await this.GetProductsFromSearch(
      "https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=24&searchType=product&q=%3Arelevance",
      false
    );
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
        if (product && enrichWithContentDetails) {
          var productDetails = await VmpClient.GetProductDetails(productId);
          product = { ...product, ...productDetails };
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

  static async GetProductDetails(productId) {
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
    return await axios(options).then(async function (res) {
      const html = res.data;

      // Use jsdom to parse the HTML
      const dom = new JSDOM(html);
      const document = dom.window.document;

      var productProps = VmpClient.GetProductPropsFromTag(document);

      // Object to store the properties
      const properties = {
        Id: productId,
        Price: productProps.price?.value ?? null,
        Color: productProps.color ?? null,
        StoragePotential: productProps.content?.storagePotential ?? null,
        Smell: productProps.smell ?? null,
        Taste: productProps.taste ?? null,
        Volume: productProps.volume.value ?? null,
        Alcohol: parseInt(
          VmpClient.GetTrait(productProps.content.traits, "Alkohol")?.replace(
            "%",
            ""
          ) ?? "0"
        ),
        Acid: VmpClient.GetTrait(productProps.content.traits, "Syre"),
        Sugar: VmpClient.GetTrait(productProps.content.traits, "Sukker"),
        Ingredients: productProps.content.ingredients ?? null,
        IsGoodFor: productProps.content.isGoodFor ?? null,
        Freshness: VmpClient.GetCharacteristic(
          productProps.content.characteristics,
          "Friskhet"
        ),
        Fullness: VmpClient.GetCharacteristic(
          productProps.content.characteristics,
          "Fylde"
        ),
        Sweetness: VmpClient.GetCharacteristic(
          productProps.content.characteristics,
          "Sødme"
        ),
        Sulfates: VmpClient.GetCharacteristic(
          productProps.content.characteristics,
          "Garvestoffer"
        ),
      };

      return properties;
    });
  }
  static GetTrait(list, slug) {
    var value = list.find((x) => x.name === slug) ?? null;
    if (value) return value.formattedValue;
    return null;
  }

  static GetCharacteristic(list, slug) {
    var value = list?.find((x) => x.name === slug) ?? null;
    if (value) return parseInt(value.value);
    return null;
  }

  static GetProductPropsFromTag(doc) {
    const mainTag = doc.querySelector("main");

    if (!mainTag) {
      console.error("Main tag not found");
      return null;
    }

    const dataReactProps = mainTag.getAttribute("data-react-props");

    if (!dataReactProps) {
      console.error("'data-react-props' attribute not found");
      return null;
    }

    try {
      return JSON.parse(dataReactProps).product;
    } catch (error) {
      console.error("Failed to parse 'data-react-props':", error);
      return null;
    }
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
}

module.exports = VmpClient;
