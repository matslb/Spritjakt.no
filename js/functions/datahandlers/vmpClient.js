const axios = require("axios");
const axiosCookieJarSupport = require("axios-cookiejar-support").default;
const tough = require("tough-cookie");
const config = require("../configs/vmp.json");
const cookieJar = new tough.CookieJar();
var HTMLParser = require("node-html-parser");
const { HeaderGenerator, PRESETS } = require("header-generator");
const { XMLParser } = require("fast-xml-parser");
const ProductSearchParser = require("./Models/ProductSearchResult");
const parser = new XMLParser();
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const firebase = require("firebase-admin");
const path = require("path");

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
      const document = Array.from(
        dom.window.document.getElementsByClassName("product__details")
      )[0];

      let typesString = VmpClient.GetAboutProductSection(document, "Varetype");
      let types =
        typesString?.split("-").map((type) => type.split(",")[0].trim()) ?? [];
      let type = types[0];
      let tags = VmpClient.GetTagsFromButtons(document, [
        "Vegansk",
        "Oransjevin",
        "Naturvin",
      ]);

      types = [...types, ...tags];

      const isGoodFor = VmpClient.GetIsGoodForFromHtml(document, "Passer til");
      const properties = {
        Id: productId,
        Alcohol: parseFloat(
          VmpClient.GetTraitFromHtml(document, "Alkohol")
            .replace("%", "")
            .replace(",", ".")
        ),
        Sugar: VmpClient.GetTraitFromHtml(document, "Sukker"),
        Acid: VmpClient.GetTraitFromHtml(document, "Syre"),
        IsGoodFor: isGoodFor,
        IsGoodForList: isGoodFor.map((g) => g.name),
        Freshness: VmpClient.GetCharacteristicFromHtml(document, "Friskhet"),
        Fullness: VmpClient.GetCharacteristicFromHtml(document, "Fylde"),
        Sulfates: VmpClient.GetCharacteristicFromHtml(document, "Garvestoffer"),
        Sweetness: VmpClient.GetCharacteristicFromHtml(document, "Sødme"),
        Bitterness: VmpClient.GetCharacteristicFromHtml(document, "Bitterhet"),
        Ingredients: VmpClient.GetIngredientsFromHtml(document),
        Smell: VmpClient.GetAboutProductSection(document, "Lukt"),
        Taste: VmpClient.GetAboutProductSection(document, "Smak"),
        Color: VmpClient.GetAboutProductSection(document, "Farge"),
        Type: type ?? null,
        Types: types,
      };

      return properties;
    });
  }

  static GetTraitFromHtml(document, traitName) {
    const traitElement = Array.from(document.querySelectorAll("strong")).find(
      (el) => el.textContent.trim() === traitName
    );

    if (traitElement) {
      const valueElement = traitElement.nextElementSibling;
      if (valueElement && valueElement.tagName === "SPAN") {
        return valueElement.textContent.trim();
      }
    }
    return null;
  }

  static GetIsGoodForFromHtml(document, listName) {
    const block = Array.from(document.querySelectorAll("h2")).find(
      (el) => el.textContent.trim() === listName
    );

    if (block) {
      const isGoodForCodes = Array.from(
        block.parentElement.querySelectorAll(".icon.product-icon.isGoodfor")
      ).map((e) => {
        const classList = e.className.split(" ");
        return classList[classList.length - 1];
      });
      let isGoodForFormatted = [];
      for (const isGoodFor of isGoodForDictionary) {
        if (isGoodForCodes.some((c) => c === isGoodFor.code))
          isGoodForFormatted.push(isGoodFor);
      }
      return isGoodForFormatted;
    }
    return [];
  }

  static GetCharacteristicFromHtml(document, characteristic) {
    const characteristicElement = Array.from(
      document.querySelectorAll("h2")
    ).find((el) => el.textContent.trim() === "Karakteristikk");

    if (characteristicElement) {
      const elements = Array.from(
        document.querySelectorAll(`li[aria-label*="${characteristic}, "]`)
      );
      if (elements && elements.length > 0) {
        const ariaLabel = elements[0].getAttribute("aria-label");
        if (ariaLabel) {
          const match = ariaLabel.match(/\d+/);
          return match ? parseInt(match[0]) : null;
        }
      }
    }
    return null;
  }

  static GetIngredientsFromHtml(document) {
    const ingredientParentElement = Array.from(
      document.querySelectorAll(".icon-raastoff")
    )[0];

    if (ingredientParentElement) {
      let ingredientElements = Array.from(
        ingredientParentElement.nextElementSibling.children
      );
      if (ingredientElements) {
        return ingredientElements.map((e) => ({
          formattedValue: e.textContent,
        }));
      }
    }
    return null;
  }

  static GetAboutProductSection(document, section) {
    const sectionSibling = Array.from(
      document.querySelectorAll(".product__tab-list li span")
    )?.find((e) => e.textContent === section);

    if (sectionSibling) {
      let sectionElement = sectionSibling.nextElementSibling;
      if (sectionElement) return sectionElement.textContent;
    }
    return null;
  }

  static GetTagsFromButtons(document, buttonTags) {
    const tagButtons = Array.from(
      document.querySelectorAll(`ul[class*="tag-list"] button`)
    )?.filter((e) => buttonTags.includes(e.textContent));

    return tagButtons?.map((b) => b.textContent) ?? [];
  }

  static async FetchProductRatingFromSource1(productId, name) {
    let rating = null;

    name = encodeURIComponent(name.replace(/(\d\d\d\d)/, ""));
    return await axios
      .get(`${config.ratingSource1}?query=${name}`)
      .then(async function (res) {
        let pageRoot = HTMLParser.parse(res.data);
        let ratingHtml = pageRoot.querySelectorAll(
          ".product-list-element .group-2 .points .number"
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
          };
        }
        rating = parseInt(ratingHtml[matchIndex].innerText);
        console.info("Successfully fetched product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
        };
      })
      .catch((err) => {
        console.error("Could not fetch product rating: " + productId);
        return {
          productId: productId,
          rating: rating,
        };
      });
  }

  static async GetProductRatingFromSource2(productName) {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"];

    var options = {
      method: "get",
      url: `${config.ratingSource2}search/wines?q=${encodeURIComponent(
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
          ? `${config.ratingSource2}wines${
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
      console.error(
        `Failed to get product rating from ${ratingSource2}:`,
        error
      );
      throw error;
    }
  }
}

const isGoodForDictionary = [
  { code: "A", name: "Aperitif" },
  { code: "B", name: "Skalldyr" },
  { code: "C", name: "Fisk" },
  { code: "D", name: "Lyst kjøtt" },
  { code: "E", name: "Storfe" },
  { code: "F", name: "Lam" },
  { code: "G", name: "Småvilt" },
  { code: "H", name: "Storvilt" },
  { code: "L", name: "Ost" },
  { code: "N", name: "Dessert" },
  { code: "Q", name: "Svin" },
  { code: "R", name: "Grønnsaker" },
];

module.exports = VmpClient;
