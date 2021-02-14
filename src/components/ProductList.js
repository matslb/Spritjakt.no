import React from "react";
import ProductComp from "./ProductComp";
import Pagination from "./Pagination";
import "./css/productList.css";
import SpritjaktClient from "../services/spritjaktClient";
import { faCircleNotch } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import sortArray from "sort-array";
import ProductPopUp from "./ProductPopUp";
import firebase from "firebase/app";
import StoreSelector from "./StoreSelector";
import { Select } from '@material-ui/core';
import queryString from "query-string";
import Notification from "./Notification";
import Filter from "./Filter";

class ProductList extends React.Component {
  constructor() {
    super();
    this.state = {
      loadedProducts: [],
      stores: [],
      loading: true,
      sort: "LastUpdated_desc",
      productTypes: {},
      productCountries: {},
      highlightedProduct: false,
      graphIsVisible: false,
      timespan: 1,
      productResult: [],
      page: 1,
      pageSize: 24,
      change: "lowered",
      filterVisibility: false,
      user: null,
      filterName: "",
      filter: {
        productTypes: [],
        stores: [],
        countries: []
      },
    };

    this.sortOptions = [
      { label: "Nyeste", value: "LastUpdated_desc" },
      { label: "Prisendring", value: "Discount" },
      { label: "Literpris", value: "Literprice_asc" },
      { label: "Student (literpris alkohol)", value: "LiterPriceAlcohol_asc" },
      { label: "Navn (A-Å)", value: "Name_asc" },
      { label: "Navn (Å-A)", value: "Name_desc" },
      { label: "Pris (lav-høy)", value: "LatestPrice_asc" },
      { label: "Pris (høy-lav)", value: "LatestPrice_desc" }
    ];
    this.timespanOptions = [
      { label: "Siste døgn", value: 1 },
      { label: "Siste 7 dager", value: 7 },
      { label: "Siste 14 dager", value: 14 },
      { label: "Siste 30 dager", value: 30 },
      { label: "Siste 90 dager", value: 90 },
      { label: "Siste 6 måneder", value: 180 }
    ];
    this.spritjaktClient = new SpritjaktClient();
    this.Notification = React.createRef();
  }

  onbackPress = (e) => {
    if (this.state.highlightedProduct) {
      this.setState({ highlightedProduct: false, graphIsVisible: false });
      this.setUrlParams("product");
    }
  }

  setUrlParams = (field, value = null) => {
    let urlParameters = this.getQuery();
    urlParameters[field] = value;

    if (value === null) {
      delete urlParameters[field];
    }

    let query = queryString.stringify(urlParameters, { arrayFormat: 'comma' });
    if (field === "product" && value !== null) {
      window.history.pushState('', '', '?' + query);
    }
    window.history.replaceState('', '', '?' + query);
  }

  applyUrlParams = (urlParameters) => {
    this.setState({ urlParameters: urlParameters });
    Object.keys(urlParameters).forEach(field => {
      const param = urlParameters[field];
      switch (field) {
        case "product":
          this.setGraph(param);
          break;
        case "page":
          this.setPage(parseInt(param));
          break;
        case "sort":
          this.setState({ sort: param });
          break;
        case "change":
          this.setState({ change: param });
          break;
        case "timespan":
          this.setState({ timespan: parseInt(param) });
          break;
        default:
          break;
      }
    });
    this.filterProducts();
  }

  getQuery = () => (queryString.parse(window.location.search, { arrayFormat: 'comma' }));

  componentDidMount() {
    window.onpopstate = (e) => this.onbackPress(e);
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        firebase.firestore().collection("Users").doc(user.uid)
          .onSnapshot((doc) => {
            if (!doc.exists) {
              return null;
            }
            let userData = doc.data();

            if (userData.products === undefined) {
              userData.products = [];
            }
            if (userData.filters === undefined) {
              userData.filters = [];
            }
            var productTypes = this.state.productTypes;
            userData.filters.forEach(filter => {
              filter.productTypes.forEach(productType => {
                if (!productTypes[productType]) {
                  productTypes[productType] = {
                    products: {}
                  }
                }
              });
            });
            this.setState({
              user: userData,
              productTypes: productTypes
            }, () => this.createFilter());
          });
      } else {
        this.setState({ user: null });
      }
    });

    this.spritjaktClient.FetchStores().then(stores => {
      this.setState({ stores: stores });
    }).then(() => {
      let query = this.getQuery();
      this.applyUrlParams(query);
      this.getProductData(query.timespan === undefined);
    });
  }

  saveUserFilter(e) {
    if (this.state.user) {
      this.spritjaktClient.SaveUserFilter(this.state.filter);
      this.Notification.current.setNotification(e, "Lagret", "success");
      this.createFilter();
    } else {
      this.props.toggleLoginSection();
    }

  }

  createFilter() {
    let query = this.getQuery();

    let newFilter = {
      productTypes: Array.isArray(query.types) ? query.types : query.types ? [query.types] : [],
      stores: Array.isArray(query.stores) ? query.stores : query.stores ? [query.stores] : [],
      countries: Array.isArray(query.countries) ? query.countries : query.countries ? [query.countries] : []
    }

    let filterExists = false;

    if ((newFilter.stores.length === 0
      && newFilter.productTypes.length === 0
      && newFilter.countries.length === 0)
      || (this.state.user
        && this.state.user.filters.find(f =>
          this.arraysAreEqual(f.stores, newFilter.stores)
          && this.arraysAreEqual(f.productTypes, newFilter.productTypes)
          && this.arraysAreEqual(f.countries, newFilter.countries)
        )
      )) {
      filterExists = true;
    }

    this.setState({ currentFilterExists: filterExists, filter: newFilter });
  }

  arraysAreEqual(arr1, arr2) {
    if (arr1?.length !== arr2?.length) {
      return false;
    }
    for (const x of arr1) {
      if (!arr2.includes(x)) {
        return false
      }
    }
    return true;
  }

  getProductData(autoFetch = false) {
    const change = this.state.change;
    this.spritjaktClient.FetchProducts(this.state.timespan, change === "lowered").then(products => this.updateProductResults(products, autoFetch));
  }

  updateProductResults(products, autoFetch = false) {
    if (products === undefined) {
      return;
    }
    let loadedProducts = [];
    let productTypes = this.state.productTypes || {};
    let productCountries = this.state.productCountries || {};
    let stores = this.state.stores;


    Object.keys(productTypes).map(
      (ptkey) =>
        (productTypes[ptkey].products = {})
    );

    //Updating existing product type counts
    Object.keys(products).forEach((id) => {
      let p = products[id];
      loadedProducts.push(p);
      if (productTypes[p.SubType] === undefined) {
        productTypes[p.SubType] = {
          products: {}
        };
      }
      if (productCountries[p.Country] === undefined) {
        productCountries[p.Country] = {
          products: {}
        };
      }
      for (const i in p.Stock.Stores) {
        if (!p.Stock.Stores[i].pointOfService) {
          p.Stock.Stores[i].pointOfService = {
            name: p.Stock.Stores[i].name,
            displayName: p.Stock.Stores[i].displayName
          }
        }
      }
    });

    this.setState({
      stores: stores,
      loadedProducts: loadedProducts,
      productTypes: productTypes,
      productCountries: productCountries,
      loading: false
    });
    this.applyUrlParams(this.getQuery());
    this.handleSortChange();

    if (autoFetch && loadedProducts.length < 200) {
      let timespanIndex = this.timespanOptions.indexOf(this.timespanOptions.find(ts => ts.value === this.state.timespan)) + 1;
      if (this.timespanOptions[timespanIndex]) {
        this.changeTimeSpan(null, this.timespanOptions[timespanIndex].value, autoFetch);
      }
    }
  }

  nextProduct = (change) => {
    let highlightedProductIndex = this.state.productResult.indexOf(this.state.highlightedProduct);
    let newHighlightedProduct = this.state.productResult[highlightedProductIndex + change] ?? null;
    this.setGraph(null, null);
    if (newHighlightedProduct) {
      this.setGraph(newHighlightedProduct.Id);
    }
  }

  setGraph(productId) {
    if (productId === null) {
      this.setState({ highlightedProduct: false, graphIsVisible: false });
      this.onbackPress();
    } else {
      this.setUrlParams("product", productId);
      let product = this.state.loadedProducts.find((p) => p.Id === productId);

      if (product === undefined) {
        this.spritjaktClient.FetchProductById(productId).then(product => {
          this.setState({ highlightedProduct: product, graphIsVisible: true });
        });
      } else {
        this.setState({ highlightedProduct: product, graphIsVisible: true });
      }

    }
  };

  resetFilter = () => {
    let productTypes = this.state.productTypes;
    Object.keys(this.state.productTypes).map(
      (pt) => (productTypes[pt].state = false)
    );
    let productCountries = this.state.productCountries;
    Object.keys(this.state.productCountries).map(
      (pt) => (productCountries[pt].state = false)
    );
    this.filterProducts();
  };

  resetFilterUrl = () => {
    this.setUrlParams("stores", null);
    this.setUrlParams("types", null);
    this.setUrlParams("countries", null);
  }

  handleFilterClick = (propSlug, items) => {
    this.setUrlParams(propSlug, items);
    this.filterProducts();
  };

  filterProducts() {
    let query = this.getQuery();
    let productTypes = this.state.productTypes;
    let productCountries = this.state.productCountries;
    let stores = this.state.stores;
    let productResult = [];
    let selectedStores = Array.isArray(query.stores) ? query.stores : query.stores ? [query.stores] : [];

    Object.keys(productTypes).forEach(pt => productTypes[pt].products = {});
    Object.keys(productCountries).forEach(c => productCountries[c].products = {});
    stores.map(s => s.products = {});

    for (let i = 0; i < this.state.loadedProducts.length; i++) {
      const p = this.state.loadedProducts[i];

      let isInStore = this.storeFilter(p, selectedStores);
      let isOfType = query.types?.includes(p.SubType) || query.types === undefined;
      let isOfCountry = query.countries?.includes(p.Country) || query.countries === undefined;

      if (isOfCountry && isOfType && isInStore) {
        productResult.push(p);
      }
      if (isInStore && isOfCountry) {
        productTypes[p.SubType].products[p.Id] = true;
      }
      if (isInStore && isOfType) {
        productCountries[p.Country].products[p.Id] = true;
      }
      if (isOfCountry && isOfType) {
        stores = stores.map(s => {

          if ((p.Stock.Stores.find(ps => ps.pointOfService.name == s.storeId)
            || (s.storeId === "online" && !(p.ProductStatusSaleName && ["Midlertidig utsolgt", "Utsolgt", "Utgått"].includes(p.ProductStatusSaleName))))) {
            s.products[p.Id] = true;
          }
          return s;
        });
      }

    }

    this.setState({
      productResult: productResult,
      page: this.state.page > Math.ceil(productResult.length / this.state.pageSize) ? 1 : this.state.page,
      productTypes: productTypes,
      productCountries: productCountries,
      stores: stores
    }, () => this.createFilter());
  }

  displayProducts = () => {
    let productResult = this.state.productResult;
    let productDisplay = [];
    let startPoint = productResult.length > this.state.pageSize ? this.state.pageSize * (this.state.page - 1) : 0;
    for (let i = startPoint; i < productResult.length; i++) {
      const p = productResult[i];
      if (productDisplay.length < this.state.pageSize) {
        productDisplay.push(
          <ProductComp key={p.Id} showDiff={true} product={p} notification={this.Notification} selectedStores={this.state.filter.stores} setGraph={this.setGraph.bind(this)} />
        );
      }
    }
    return productDisplay;
  }

  formatDate = (date) => {
    date.setHours(date.getHours() + 2);
    return date.toISOString().slice(0, 10);
  };

  handleSortChange = (event = null) => {
    let option = event?.target?.value || this.state.sort;
    if (event) {
      this.setUrlParams("sort", option);
    }
    let sortingCriteria = option.split("_");
    let sortField = sortingCriteria[0];
    let sortOrder = sortingCriteria[1];

    var discountOrder = this.state.change === "raised" ? "desc" : "asc";
    if (sortField === "Discount") {
      sortOrder = discountOrder;
    }

    let list = this.state.loadedProducts;

    sortArray(list, {
      by: [sortField, "Discount"],
      order: [sortOrder, discountOrder],
    });

    this.setState({
      loadedProducts: list,
      sort: option
    }, () => this.filterProducts());
  };

  storeFilter = (p, selectedStores) => {
    let isOnline = undefined;

    if (selectedStores.includes("online")) {
      isOnline = !(p.ProductStatusSaleName && ["Midlertidig utsolgt", "Utsolgt", "Utgått"].includes(p.ProductStatusSaleName));
    }

    if (isOnline || (selectedStores.length === 0 || p.Stock.Stores.find((s) => selectedStores.includes(s.pointOfService.name)))) {
      return true;
    }

    return false;
  }

  changeTimeSpan = (event, timespan, autoFetch = false) => {
    let option = event?.target?.value || timespan;
    this.setState({
      timespan: option,
      loading: true
    },
      () => {
        if (event) {
          this.setUrlParams("timespan", option);
        }
        this.getProductData(autoFetch);
      }
    );
  };
  setPage = (page) => {
    this.setState({ page: page });
    this.setUrlParams("page", page);
  }
  render() {

    let {
      loading,
      pageSize,
      page,
      productResult,
      stores,
      productTypes,
      productCountries,
      filter,
      user,
      currentFilterExists,
    } = this.state;

    return (
      <div key="Productlist" className="Productlist" >
        <div className="main">
          <main>
            <div className="before-products">
              <div className="nav">
                {currentFilterExists &&
                  <div className="discount-filter">
                    <a
                      className={"clickable " + (this.state.change === "lowered" ? "active" : "")}
                      href={"/"}
                    >Ned i pris</a>
                    <a
                      className={"clickable " + (this.state.change === "raised" ? "active" : "")}
                      href={"?change=raised"}
                    >Opp i pris</a>
                  </div>
                }
                {(!currentFilterExists && !loading && filter) &&
                  <div className="filterSaver">
                    <button className="bigGoldBtn clickable" onClick={(e) => { this.saveUserFilter(e) }}>Lagre filter</button>
                    <div>
                      <span>Få varsel når produkter som matcher dette filteret kommer på tilbud. </span>
                      {user && !user.notifications.onFilters &&
                        <div>
                          <strong>Husk å tillate varsler på lagrede filtre i menyen under "Kontoinnstillinger"</strong>
                        </div>
                      }
                    </div>
                  </div>
                }
                {this.state.stores.length > 0 &&
                  <StoreSelector handleStoreUpdate={this.handleFilterClick.bind(this)} selectedStores={filter.stores} stores={stores} />
                }
                <Filter items={productTypes} selectedItems={filter.productTypes} propSlug={"types"} label={"Type"} handleFilterChange={this.handleFilterClick.bind(this)} />
                <Filter items={productCountries} selectedItems={filter.countries} propSlug={"countries"} label={"Land"} handleFilterChange={this.handleFilterClick.bind(this)} />
                <div className="sorting">
                  <label htmlFor="sorting">Sortering
                <Select
                      native
                      value={this.state.sort}
                      onChange={this.handleSortChange}
                      inputProps={{
                        name: 'sorting',
                        id: 'sorting',
                      }}
                    >
                      {this.sortOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </label>
                </div>
                <div className='timespan'>
                  <label htmlFor="timespan">Tidsperiode
                <Select
                      native
                      value={this.state.timespan}
                      onChange={this.changeTimeSpan}
                      inputProps={{
                        name: 'timespan',
                        id: 'timespan',
                      }}
                    >
                      {this.timespanOptions.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </Select>
                  </label>
                </div>
              </div>
            </div>
            <Pagination
              total={productResult.length}
              page={this.state.page}
              setPage={this.setPage.bind(this)}
              pageSize={pageSize}
              loading={this.state.loading}
            />
            <ul className="product-list">
              {loading && productResult.length === 0 &&
                <div className="product-list-loader">
                  <FontAwesomeIcon icon={faCircleNotch} size="5x" />
                </div>
              }
              {this.displayProducts()}
              {productResult.length === 0 && this.state.loading === false ? (
                <p
                  style={{
                    textAlign: "center",
                    position: "absolute",
                    left: 0,
                    right: 0,
                    margin: "auto"
                  }}
                >Her var det ikke noe, gitt...</p>) : ("")}
            </ul>
            <Pagination
              total={productResult.length}
              page={page}
              setPage={this.setPage.bind(this)}
              pageSize={pageSize}
              loading={this.state.loading}
            />
            <ProductPopUp product={this.state.highlightedProduct} notification={this.Notification} graphIsVisible={this.state.graphIsVisible} nextProduct={this.nextProduct.bind(this)} setGraph={this.setGraph.bind(this)} />
            <div
              className={
                "filter-backdrop " +
                (this.state.filterVisibility ? "active" : "inactive")
              }
              onClick={() => this.setState({ filterVisibility: false })}
            ></div>
          </main>
        </div>
        <Notification ref={this.Notification} />
      </div>
    );
  }
}

export default ProductList;
