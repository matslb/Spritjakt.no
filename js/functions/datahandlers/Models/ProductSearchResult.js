module.exports = class ProductSearchParser {
  static GetProductFromSearchResult = (productId, jsonData) => {
    const facets = (jsonData.facets || []).map(
      (facetData) => new Facet(facetData)
    );
    const stores = facets
      .find((x) => x.code === "availableInStores")
      ?.values.map((f) => f.code);

    const year =
      facets.find((x) => x.code === "year")?.values?.map((f) => f.code)[0] ||
      "0000";

    const vintageComment =
      facets
        .find((x) => x.code === "Lagringsgrad")
        ?.values?.map((f) => f.code)[0] || "";

    const productData = jsonData.products.filter((p) => p.code == productId)[0];
    if (!productData) return null;

    if (productData === null || productData === undefined) return null;

    let product = NewProductUpdateRecord(
      productData,
      stores,
      year,
      vintageComment
    );
    return product ?? null;
  };

  static GetProductsFromSearchResult = (jsonData) => {
    return (jsonData.productSearchResult.products || []).map((productData) =>
      NewProductUpdateRecord(productData)
    );
  };
};
class Facet {
  constructor(facetData) {
    this.category = facetData.category || false;
    this.code = facetData.code || "";
    this.multiSelect = facetData.multiSelect || false;
    this.name = facetData.name || "";
    this.priority = facetData.priority || 0;
    this.values = (facetData.values || []).map(
      (valueData) => new FacetValue(valueData)
    );
    this.visible = facetData.visible || true;
  }
}

class FacetValue {
  constructor(valueData) {
    this.code = valueData.code || "";
    this.count = valueData.count || 0;
    this.name = valueData.name || "";
    this.query = valueData.query || {};
    this.selected = valueData.selected || false;
  }
}

NewProductUpdateRecord = (productData, stores, year, vintageComment) => {
  return {
    AvailableOnline:
      productData.productAvailability?.deliveryAvailability
        ?.availableForPurchase || false,
    Buyable: productData.buyable || false,
    Id: productData.code || "",
    Expired: productData.expired || false,
    Name: productData.name || "",
    Price: productData.price.value || {},
    ReleaseMode: productData.releaseMode || false,
    Status: productData.status || "",
    Volume: productData.volume.value || {},
    Country: productData.main_country?.name || "",
    District: productData.district?.name || null,
    SubDistrict: productData.sub_District?.name || null,
    Year: year || null,
    IsVintage: false,
    VintageComment: vintageComment,
    Stores: (stores || []).concat(
      productData.productAvailability?.deliveryAvailability
        ?.availableForPurchase === true
        ? ["online"]
        : []
    ),
  };
};
