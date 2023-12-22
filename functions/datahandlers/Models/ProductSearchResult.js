module.exports = GetProductFromSearchResult = (jsonData) =>  {
    const facets = (jsonData.productSearchResult.facets || []).map(facetData => new Facet(facetData));
    const stores = facets.find(x => x.code === "availableInStores").values.map(f => f.code);
    this.pagination = jsonData.productSearchResult.pagination || {};
    this.products = (jsonData.productSearchResult.products || []).map(productData => new Product(productData, stores ));
    return this.products[0];
}

class Facet {
    constructor(facetData) {
        this.category = facetData.category || false;
        this.code = facetData.code || "";
        this.multiSelect = facetData.multiSelect || false;
        this.name = facetData.name || "";
        this.priority = facetData.priority || 0;
        this.values = (facetData.values || []).map(valueData => new FacetValue(valueData));
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

class Product {
    constructor(productData, stores) {
        this.availability = productData.availability || {};
        this.buyable = productData.buyable || false;
        this.id = productData.code || "";
        this.district = productData.district || {};
        this.expired = productData.expired || false;
        this.main_category = productData.main_category || {};
        this.main_country = productData.main_country || {};
        this.main_sub_category = productData.main_sub_category || {};
        this.name = productData.name || "";
        this.price = productData.price || {};
        this.product_selection = productData.product_selection || "";
        this.releaseMode = productData.releaseMode || false;
        this.status = productData.status || "";
        this.sub_District = productData.sub_District || {};
        this.sustainable = productData.sustainable || false;
        this.url = productData.url || "";
        this.volume = productData.volume || {};
        this.stores = stores || [];
        
        if(this.availability?.deliveryAvailability?.available === true){
            this.stores.push("online");
        }
    }
}

