module.exports = class ProductSearchParser {
  static GetProductFromSearchResult = (productId, jsonData) => {
    const facets = (jsonData.productSearchResult.facets || []).map(
      (facetData) => new Facet(facetData)
    );
    const stores = facets
      .find((x) => x.code === "availableInStores")
      ?.values.map((f) => f.code);

    const year =
      facets.find((x) => x.code === "year")?.values?.map((f) => f.code)[0] ||
      "0000";

    const productData = jsonData.productSearchResult.products.filter(
      (p) => p.code == productId
    )[0];
    if (!productData) return null;

    if (productData === null || productData === undefined) return null;

    let product = NewProductUpdateRecord(productData, stores, year);

    product.Types = [
      ...new Set(
        product.Types.concat(
          facets
            .find((x) => x.code === "mainCategory")
            ?.values.map((f) => f.name)
        ).map((t) => t.replaceAll(",", "."))
      ),
    ];

    const categoriesInFacets = ["Vegansk", "Oransjevin", "Naturvin"];
    categoriesInFacets.forEach((cat) => {
      const exists = facets.find((x) => x.name === cat);
      if (exists) product.Types.push(cat);
    });
    return product ?? null;
  };

  static GetProductsFromSearchResult = (jsonData) => {
    return (jsonData.productSearchResult.products || []).map((productData) =>
      NewProductUpdateRecord(productData, [])
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

NewProductUpdateRecord = (productData, stores, year) => {
  let types = [];

  if (productData.main_category) types.push(productData.main_category.name);

  if (productData.main_sub_category?.name) {
    if (productData.main_sub_category.name.includes(", ")) {
      types.push(productData.main_sub_category.name.split(", ")[0]);
    }
    types.push(productData.main_sub_category.name);
  }

  return {
    AvailableOnline:
      productData.availability?.deliveryAvailability?.available || false,
    Buyable: productData.buyable || false,
    Id: productData.code || "",
    //    district:productData.district || {},
    Expired: productData.expired || false,
    Types: types,
    //    main_category:productData.main_category || {},
    //    main_country:productData.main_country || {},
    //    main_sub_category:productData.main_sub_category || {},
    Name: productData.name || "",
    Price: productData.price.value || {},
    //    product_selection:productData.product_selection || "",
    ReleaseMode: productData.releaseMode || false,
    Status: productData.status || "",
    //    sub_District:productData.sub_District || {},
    //    sustainable:productData.sustainable || false,
    //    url:productData.url || "",
    Volume: productData.volume.value || {},
    Year: year || null,
    IsVintage: false,
    Stores: (stores || []).concat(
      productData.availability?.deliveryAvailability?.available === true
        ? ["online"]
        : []
    ),
  };
};
