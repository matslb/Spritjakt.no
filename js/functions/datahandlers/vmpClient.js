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
      url: `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?fields=FULL&pageSize=24&currentPage=0&q=${productId}:relevance`,
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

      // Parse the full document; the page is now mostly script-driven and no
      // longer exposes the old .product__details markup consistently.
      const dom = new JSDOM(html);
      const document = dom.window.document;

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
      const alcoholText = VmpClient.GetTraitFromHtml(document, "Alkohol");
      const properties = {
        Id: productId,
        Alcohol: alcoholText
          ? parseFloat(alcoholText.replace("%", "").replace(",", "."))
          : null,
        Sugar: VmpClient.GetTraitFromHtml(document, "Sukker"),
        Acid: VmpClient.GetTraitFromHtml(document, "Syre"),
        IsGoodFor: isGoodFor,
        IsGoodForList: isGoodFor.map((g) => g.name),
        Freshness: VmpClient.GetCharacteristicFromHtml(document, "Friskhet"),
        Fullness: VmpClient.GetCharacteristicFromHtml(document, "Fylde"),
        Sulfates: VmpClient.GetCharacteristicFromHtml(
          document,
          "Garvestoffer"
        ),
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
    const root = document.body || document;

    const normalized = (value) => (value || "").replace(/\s+/g, " ").trim();

    const traitElement = Array.from(
      root.querySelectorAll("strong, dt, label, span, div")
    ).find((el) => normalized(el.textContent) === traitName);

    if (traitElement) {
      const candidates = [
        traitElement.nextElementSibling,
        traitElement.parentElement?.querySelector("span:not(:first-child)"),
        traitElement.closest("dl")?.querySelector("dd"),
        traitElement.closest("li")?.querySelector("span:last-child"),
      ].filter(Boolean);

      for (const valueElement of candidates) {
        const text = normalized(valueElement.textContent);
        if (text) return text;
      }
    }

    const textMatch = Array.from(root.querySelectorAll("*")).find((el) => {
      const text = normalized(el.textContent);
      return text.startsWith(`${traitName} `) || text.includes(`${traitName}:`);
    });

    if (textMatch) {
      const text = normalized(textMatch.textContent);
      const value = text
        .replace(new RegExp(`^${traitName}\\s*:?\\s*`, "i"), "")
        .trim();
      return value || null;
    }

    return null;
  }

  static GetIsGoodForFromHtml(document, listName) {
    const root = document.body || document;

    const normalized = (value) => (value || "").replace(/\s+/g, " ").trim();

    const sectionHeader = Array.from(
      root.querySelectorAll("h1, h2, h3, h4, span, strong, div, p")
    ).find((el) => {
      const el_normalized = normalized(el.textContent);
      return el_normalized === listName && el.children.length === 0;
    });

    if (!sectionHeader) return [];

    // Find the containing list: the header's parent div should contain a <ul>
    const container =
      sectionHeader.parentElement ||
      sectionHeader.closest("section") ||
      root;

    const listItems = Array.from(container.querySelectorAll("li"));

    // Extract display names from list items
    const names = listItems
      .map((li) => {
        // Look for a text label div inside the li
        const labelDiv = li.querySelector("div:not(.icon)");
        return labelDiv ? normalized(labelDiv.textContent) : null;
      })
      .filter(Boolean);

    return isGoodForDictionary.filter((isGoodFor) =>
      names.includes(isGoodFor.name)
    );
  }

  static GetCharacteristicFromHtml(document, characteristic) {
    const root = document.body || document;

    const characteristicElement = Array.from(
      root.querySelectorAll("h2, h3, span")
    ).find((el) => el.textContent.trim() === "Karakteristikk");

    if (characteristicElement) {
      const scope =
        characteristicElement.closest("section") ||
        characteristicElement.parentElement ||
        root.body ||
        root;

      const elements = Array.from(
        scope.querySelectorAll(`[aria-label*="${characteristic}, "]`)
      );

      if (elements && elements.length > 0) {
        const ariaLabel = elements[0].getAttribute("aria-label");
        if (ariaLabel) {
          const match = ariaLabel.match(/\d+/);
          return match ? parseInt(match[0]) : null;
        }
      }

      const textElement = Array.from(scope.querySelectorAll("*")).find((el) =>
        el.textContent && el.textContent.includes(characteristic)
      );
      if (textElement) {
        const match = textElement.textContent.match(/(\d+)/);
        return match ? parseInt(match[1]) : null;
      }
    }

    return null;
  }

  static GetIngredientsFromHtml(document) {
    const root = document.body || document;

    const normalized = (value) => (value || "").replace(/\s+/g, " ").trim();

    // New structure: ingredients are inside the "Stil, lagring og råstoff" section
    // as <div aria-label="Riesling 100 prosent">Riesling 100%</div>
    const raastoffHeader = Array.from(
      root.querySelectorAll("h2, h3, span, strong")
    ).find((el) => {
      const text = normalized(el.textContent);
      return text.toLowerCase().includes("råstoff");
    });

    if (raastoffHeader) {
      const container =
        raastoffHeader.parentElement ||
        raastoffHeader.closest("section") ||
        root;

      // Look for elements with aria-label containing "prosent"
      const ingredientElements = Array.from(
        container.querySelectorAll("[aria-label*='prosent']")
      );

      if (ingredientElements.length > 0) {
        return ingredientElements.map((e) => ({
          formattedValue: e.textContent.trim(),
        }));
      }
    }

    // Fallback: old structure with .icon-raastoff
    const ingredientParentElement = Array.from(
      root.querySelectorAll(".icon-raastoff, [class*='raastoff']")
    )[0];

    if (ingredientParentElement) {
      const sibling = ingredientParentElement.nextElementSibling;
      if (sibling && sibling.children) {
        let ingredientElements = Array.from(sibling.children);
        if (ingredientElements) {
          return ingredientElements.map((e) => ({
            formattedValue: e.textContent.trim(),
          }));
        }
      }
    }

    return null;
  }

  static GetAboutProductSection(document, section) {
    const root = document.body || document;

    const normalized = (value) => (value || "").replace(/\s+/g, " ").trim();

    const sectionSibling = Array.from(
      root.querySelectorAll(
        ".product__tab-list li span, h2, h3, dt, button, a, span"
      )
    )?.find((e) => normalized(e.textContent) === section);

    if (sectionSibling) {
      const candidates = [
        sectionSibling.nextElementSibling,
        sectionSibling.parentElement?.nextElementSibling,
        sectionSibling.closest("li")?.querySelector("p, div, span:last-child"),
        sectionSibling.closest("section")?.querySelector(
          ".content, .description, p, div"
        ),
      ].filter(Boolean);

      for (const sectionElement of candidates) {
        const text = normalized(sectionElement.textContent);
        if (text) return text;
      }
    }

    return null;
  }

  static GetTagsFromButtons(document, buttonTags) {
    const root = document.body || document;

    const tagButtons = Array.from(
      root.querySelectorAll(`ul[class*="tag-list"] button, button, a, span`)
    )?.filter((e) => buttonTags.includes(e.textContent.trim()));

    return tagButtons?.map((b) => b.textContent.trim()) ?? [];
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
