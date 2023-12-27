const axios = require("axios");
const axiosCookieJarSupport = require('axios-cookiejar-support').default;
const tough = require('tough-cookie');
const config = require("../configs/vmp.json");
const cookieJar = new tough.CookieJar();
var HTMLParser = require('node-html-parser');
const { HeaderGenerator, PRESETS } = require('header-generator');
const { XMLParser} = require("fast-xml-parser");
const  ProductSearchParser  = require("./Models/ProductSearchResult");
const parser = new XMLParser();
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

  static async GetNewProductList(page)
  {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"]
    const options = {
      method: "get",
      url: `https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=24&searchType=product&currentPage=${page}&q=%3Arelevance%3AnewProducts%3Atrue`,
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    return await axios(options).then(async function (res) {
      return ProductSearchParser.GetProductsFromSearchResult(res.data);
    })
      .catch(function (err) {
        return [];
      });
  }

  static async GetProductsInStore(storeId) 
  {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"]
    let page = 0;
    let totalResults = 1;
    let productsInStore = [];
    
    while ( productsInStore.length < totalResults || totalResults == 0 ){      
      const options = {
        method: "get",
        url: `https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=24&searchType=product&currentPage=${page}&q=%3Arelevance%3AavailableInStores%3A${storeId}`,
        jar: cookieJar,
        headers: headers,
        withCredentials: true,
      };
       await axios(options)
          .then(async function (res) {
            var pagination = res.data.productSearchResult.pagination;
            totalResults = pagination.totalResults;
            productsInStore = productsInStore.concat(ProductSearchParser.GetProductsFromSearchResult(res.data));
          });
        
        await new Promise(r => setTimeout(r, 100));
      page++;
    }

    return productsInStore;
  }


  static async GetProductDetails(productId) 
  {
    const headerGenerator = new HeaderGenerator(PRESETS.MODERN_WINDOWS_CHROME);
    var headers = headerGenerator.getHeaders();
    delete headers["accept"]
    const options = {
      method: "get",
      url: `https://www.vinmonopolet.no/vmpws/v2/vmp/search?fields=FULL&pageSize=100&searchType=product&currentPage=0&q=${productId}:relevance`,
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    return await axios(options).then(async function (res) {
      return {product : ProductSearchParser.GetProductFromSearchResult(productId, res.data)};
    })
      .catch(function (err) {
        return {error: err};
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
    delete headers["accept"]

    var options = {
      method: "get",
      url: "https://www.vinmonopolet.no/vmpws/v2/vmp/products/" + productId + "?fields=FULL",
      jar: cookieJar,
      headers: headers,
      withCredentials: true,
    };
    return await axios(options).then(async function (res) {

      if (parser.parse(res?.data).product?.main_category?.code === "gaveartikler_og_tilbehør") {
        return { product: false };
      }

      let p = CreateProduct(res.data);
      if(p.LatestPrice === 0)
        return {product: false};
      
        return { product: p };
    })
      .catch(function (err) {
        console.error("Could not fetch price of product " + productId + ": " + err);
        return { error: err };
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
  let types = [];
  
  let type = productData.main_category.name;   
  types.push(productData.main_category.name.split(",")[0]);

  if(productData.main_sub_category){
    type = productData.main_sub_category.name.split(",")[0];
    types.push(type);
  }
  if(productData.main_sub_sub_category){
    type = productData.main_sub_sub_category.name.split(",")[0];
    types.push(type);
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
    Sweetness: productData.sweetness || null,
    Fullness: productData.fullness || null,
    Freshness: productData.freshness || null,
    Sulfates: productData.sulfates || null,
    Expired: productData.expired,
    Buyable: productData.buyable,
    Status: productData.status || null,
    Availability: productData.availability.deliveryAvailability.mainText || null,
    LatestPrice: productData.price ? productData.price.value : null,
    ProductStatusSaleName: "",
    //Stores: productData.stores || [],
    Year: productData.year || null,
    VintageComment: productData.matured || null
  }
}

module.exports = VmpClient;
