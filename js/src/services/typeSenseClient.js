import { SearchClient as TypesenseSearchClient } from "typesense";
import config from "../config.json";
import { sortOptions } from "../utils/utils";

const collection = "Products_v1.53";

class TypeSenseClient {
  constructor() {
    this.client = new TypesenseSearchClient({
      nodes: [
        {
          host: config.typeSense.host,
          port: "443",
          protocol: "https",
        },
      ],
      apiKey: config.typeSense.publicKey,
      connectionTimeoutSeconds: 2,
    });
  }

  createFacetSearchParams(filter, facetSlug, filterSlug) {
    if (filter[filterSlug] == undefined) return;
    if (filter.searchString == null) filter[filterSlug] = [];
    let searchParameters = {
      facet_by: facetSlug,
      filter_by: this.createFilterString(filter),
      page: 1,
      pageSize: 1,
    };
    return searchParameters;
  }

  retrieveFacetCount(result, facetSlug) {
    return result?.facet_counts?.filter((fc) => fc.field_name === facetSlug)[0];
  }

  async fetchHallOfFameProducts() {
    let result = await this.client.multiSearch.perform(
      {
        searches: [
          {
            filter_by: "Buyable:=true",
            sort_by: "PriceChange:asc",
          },
          {
            filter_by: "Buyable:=true",
            sort_by: "LiterPriceAlcohol:asc",
          },
          {
            filter_by: "Buyable:=true",
            sort_by: "VivinoRating:desc",
          },
          {
            filter_by: "Buyable:=true && VivinoRating:>= 0",
            sort_by: "VivinoRating:asc",
          },
          {
            filter_by: "Buyable:=true",
            sort_by: "LiterPriceAlcohol:desc",
          },
          {
            filter_by: "Buyable:=true",
            sort_by: "PriceChange:desc",
          },
          {
            filter_by: "Buyable:=true",
            sort_by: "PriceChanges:desc",
          },
        ],
      },
      {
        collection: collection,
        query_by: "Id",
        q: "*",
        pageSize: 1,
        page: 1,
        filter_by: "Buyable:=true",
        use_cache: true,
        cache_ttl: 300,
      }
    );

    return {
      largestDiscount: result.results[0].hits[0].document,
      cheapestByAlcohol: result.results[1].hits[0].document,
      highestRated: result.results[2].hits[0].document,
      lowestRated: result.results[3].hits[0].document,
      mostExpensiveByAlcohol: result.results[4].hits[0].document,
      largestRise: result.results[5].hits[0].document,
      mostVolatile: result.results[6].hits[0].document,
    };
  }

  async fetchProductVintages(productId) {
    let searchParameters = {
      per_page: 15,
      page: 1,
    };

    let multiSearchRequest = {
      searches: [searchParameters],
    };

    let request = await this.client.multiSearch.perform(multiSearchRequest, {
      collection: collection,
      query_by: "Id",
      q: productId,
      sort_by: sortOptions[0].typeSenseValue,
      max_facet_values: 1000,
      use_cache: false,
      cache_ttl: 300,
      num_typos: 0,
      min_len_1typo: 5,
      min_len_2typo: 8,
    });
    let result = request.results[0];
    if (result.hits == undefined) {
      result.hits = [];
      result.facet_counts = [];
    }

    return result;
  }

  async fetchProducts(filter, pageSize, doFacetSearch = true) {
    let searchParameters = {
      facet_by: "Types,Country,Stores,IsGoodForList",
      filter_by: this.createFilterString(filter),
      per_page: pageSize,
      page: filter.page || 1,
    };

    let multiSearchRequest = {
      searches: [searchParameters],
    };

    if (doFacetSearch) {
      multiSearchRequest.searches.push(
        this.createFacetSearchParams(
          Object.assign({}, filter),
          "Types",
          "types"
        )
      );
      multiSearchRequest.searches.push(
        this.createFacetSearchParams(
          Object.assign({}, filter),
          "Country",
          "countries"
        )
      );
      multiSearchRequest.searches.push(
        this.createFacetSearchParams(
          Object.assign({}, filter),
          "Stores",
          "stores"
        )
      );
      multiSearchRequest.searches.push(
        this.createFacetSearchParams(
          Object.assign({}, filter),
          "IsGoodForList",
          "isGoodFor"
        )
      );
    }

    let isIdSearch = filter.searchString?.trim().match(/^(\d{4,})$/);
    let request = await this.client.multiSearch.perform(multiSearchRequest, {
      collection: collection,
      query_by: isIdSearch ? "Id" : "Name",
      q: filter.searchString || "*",
      sort_by:
        sortOptions.find((s) => s.value === filter.sort)?.typeSenseValue ||
        sortOptions[0].typeSenseValue,
      max_facet_values: 1000,
      use_cache: false,
      cache_ttl: 300,
      num_typos: isIdSearch ? 0 : 1,
      min_len_1typo: 5,
      min_len_2typo: 8,
    });
    let result = request.results[0];
    result.facet_counts = result.facet_counts?.map((f) => {
      if (f.field_name === "Types") {
        return this.retrieveFacetCount(request.results[1], "Types");
      }
      if (f.field_name === "Country") {
        return this.retrieveFacetCount(request.results[2], "Country");
      }
      if (f.field_name === "Stores") {
        return this.retrieveFacetCount(request.results[3], "Stores");
      }
      if (f.field_name === "IsGoodForList") {
        return this.retrieveFacetCount(request.results[4], "IsGoodForList");
      }
      return f;
    });
    if (result.hits == undefined) {
      result.hits = [];
      result.facet_counts = [];
    }

    return result;
  }

  createFilterString(filter) {
    let filterString = "Types:!=Alkoholfritt && IsVintage:!= true ";

    if (!filter.searchString) {
      filterString += "&& Expired:!= true ";
    }

    if (!filter.view) {
      filterString += "&& Buyable:=true";
    }
    if (filter.types && filter.types.length > 0) {
      filterString += " && Types: [" + filter.types.join() + "]";
    }
    if (filter.countries && filter.countries.length > 0) {
      filterString += " && Country: [" + filter.countries.join() + "]";
    }
    if (filter.stores && filter.stores.length > 0) {
      filterString += " && Stores: [" + filter.stores.join() + "]";
    }
    if (filter.isGoodFor && filter.isGoodFor.length > 0) {
      filterString += " && IsGoodForList: [" + filter.isGoodFor.join() + "]";
    }
    if (filter.max) {
      filterString += " && LatestPrice:" + "<=" + filter.max;
    }
    if (filter.min) {
      filterString += " && LatestPrice:" + ">=" + filter.min;
    }

    if (filter.volume && filter.volume.length > 0) {
      filterString += ` && Volume:[${filter.volume.map((v, i) =>
        i > 0 ? "," + v : v
      )}]`;
      //filter.volume.map((v, i) => filterString += `${i > 0 ? " || " : "" }Volume:${v}` );
      //filterString += "";
    }

    return filterString;
  }
}

export default TypeSenseClient;
