import React from "react";
import ProductComp from "./ProductComp";
import ProductType from "./ProductType";
import Pagination from "./Pagination";
import "./css/productList.css";
import SpritjaktClient from "../services/spritjaktClient";
import { faCircleNotch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SortArray from "sort-array";
import ProductPopUp from "./ProductPopUp";
import { isMobileOnly } from "react-device-detect";
import firebase from "firebase/app";
import StoreSelector from "./StoreSelector";
import { Select } from '@material-ui/core';
import queryString from "query-string";
import Notification from "./Notification";


class ProductList extends React.Component {
  constructor() {
    super();
    this.state = {
      loadedProducts: [],
      stores: [],
      selectedStores: ["0"],
      loading: true,
      sort: "LastUpdated_desc",
      productTypes: {},
      showAllresults: true,
      highlightedProduct: false,
      graphIsVisible: false,
      timeSpan: 7,
      productResult: [],
      page: 1,
      pageSize: 24,
      change: "lowered",
      filterVisibility: false,
      user: null,
      urlParameters: {},
      filterName: ""
    };

    this.sortOptions = [
      { label: "Nyeste", value: "LastUpdated_desc" },
      { label: "Prisendring", value: "SortingDiscount" },
      { label: "Navn (A-Å)", value: "Name_asc" },
      { label: "Navn (Å-A)", value: "Name_desc" },
      { label: "Pris (lav-høy)", value: "LatestPrice_asc" },
      { label: "Pris (høy-lav)", value: "LatestPrice_desc" }
    ];
    this.timeSpanOptions = [
      { label: "Siste 7 dager", value: 7 },
      { label: "Siste 14 dager", value: 14 },
      { label: "Siste 30 dager", value: 30 },
      { label: "Siste 90 dager", value: 90 }
    ];
    this.spritjaktClient = new SpritjaktClient();
    this.Notification = React.createRef();
  }

  onbackPress = (e) => {
    if (this.state.highlightedProduct) {
      this.setState({ highlightedProduct: false, showGraph: false });
      this.setUrlParams("product");
    }
  }
  resetUrlParams = () => {
    this.setState({ urlParameters: {} });
    window.history.replaceState('', '', '?');
  }
  setUrlParams = (field, value = null) => {
    let urlParameters = this.state.urlParameters;
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

  async updateUrlParams() {
    this.selectAllTypes(false);
    await this.setState({ urlParameters: queryString.parse(window.location.search, { arrayFormat: 'comma' }) });
    this.applyUrlParams();
  }
  applyUrlParams = (urlParameters = this.state.urlParameters) => {
    this.setState({ urlParameters: urlParameters });
    Object.keys(urlParameters).forEach(field => {
      const param = urlParameters[field];
      switch (field) {
        case "product":
          this.setGraph(param);
          break;
        case "filter":
          if (Array.isArray(param)) {
            param.forEach(pt => {
              if (this.state.productTypes && this.state.productTypes[pt]) {
                this.handleFilterClick(true, pt)
              }
            })
          } else {
            if (this.state.productTypes && this.state.productTypes[param]) {
              this.handleFilterClick(true, param);
            };
          }
          break;
        case "page":
          this.setPage(parseInt(param));
          break;
        case "stores":
          if (Array.isArray(param)) {
            this.handleStoreUpdate(param);
          } else {
            this.handleStoreUpdate([param]);
          }
          break;
        case "sort":
          this.setState({ sort: param });
          break;
        case "page":

          this.setState({ page: param });
          break;
        case "change":
          this.setState({ change: param });
          break;
        case "timespan":
          this.setState({ timeSpan: parseInt(param) });
          break;
        default:
          break;
      }
    });
  }

  async componentDidMount() {
    window.onpopstate = (e) => this.onbackPress(e);

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        firebase.firestore().collection("Users").doc(user.uid)
          .onSnapshot(async (doc) => {
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

            this.setState({ user: userData });
            this.createFilter();
          });
      } else {
        this.setState({ user: null });
      }
    });

    this.spritjaktClient.FetchStores().then(stores => {
      SortArray(stores, {
        by: ["city", "storeName"],
        computed: {
          city: s => s.address.city
        }
      });
      this.setState({ stores: stores });
    }).then(
      this.spritjaktClient.FetchProductTypes().then((productTypes) => {
        this.setState({ productTypes: productTypes });
      }).then(async () => {
        this.applyUrlParams(queryString.parse(window.location.search, { arrayFormat: 'comma' }));
        await this.getProductData(this.state.timeSpan, true);
      })
    );
  }

  async SaveUserFilter(e) {

    if (this.state.user) {
      this.spritjaktClient.SaveUserFilter(this.state.filter);
      this.Notification.current.setNotification(e, "Lagret", "success");
      this.createFilter();
    } else {
      this.props.toggleLoginSection();
    }

  }

  createFilter(selectedStores = this.state.selectedStores.filter(s => s !== "0")) {
    let productTypesInFilter = [];
    Object.keys(this.state.productTypes).forEach(pt => {
      if (this.state.productTypes[pt].state) {
        productTypesInFilter.push(pt);
      }
    })

    let newFilter = {
      productTypes: productTypesInFilter,
      stores: selectedStores
    }

    let filterExists = false;

    if (this.state.user && this.state.user.filters.find(f => this.arraysAreEqual(f.stores, newFilter.stores) && this.arraysAreEqual(f.productTypes, newFilter.productTypes))) {
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

  async getProductData(timeSpan, firstLoad = false) {
    let products = [];
    const change = this.state.change;

    if (firstLoad) {
      let timespanIndex = this.timeSpanOptions.indexOf(this.timeSpanOptions.find(ts => ts.value === timeSpan));
      while (timespanIndex < this.timeSpanOptions.length && products.length < this.state.pageSize) {
        this.setState({ loading: true });
        products = await this.spritjaktClient.FetchProducts(this.timeSpanOptions[timespanIndex].value, change === "lowered");
        this.updateProductResults(products);
        timespanIndex++;
      }
      timeSpan = this.timeSpanOptions[timespanIndex - 1].value;
    } else {
      this.spritjaktClient.FetchProducts(timeSpan, change === "lowered").then(products => this.updateProductResults(products));
      this.setPage(1);
    }
  }

  updateProductResults(products) {
    let loadedProducts = [];
    let productTypes = this.state.productTypes;
    let stores = this.state.stores;

    stores.map(s => delete s.count);

    Object.keys(productTypes).map(
      (ptkey) =>
        (productTypes[ptkey].products = {})
    );
    let selectedTypes = Object.keys(productTypes).filter((pt) => {
      return productTypes[pt].state;
    });

    //Updating existing product type counts
    Object.keys(products).forEach((id) => {
      let p = products[id];
      loadedProducts.push(p);
      if (productTypes[p.SubType] === undefined) {
        productTypes[p.SubType] = {
          state: false,
          products: {}
        };
      }
      for (const i in p.Stock.Stores) {
        const store = p.Stock.Stores[i];
        stores.forEach(s => {
          if (s.storeId === store.name) {
            if (s.count === undefined) {
              s.count = 0;
            }
            s.count++;
          }
        });
      }
    });

    this.setState({
      stores: stores,
      loadedProducts: loadedProducts,
      productTypes: productTypes,
      loading: false,
      showAllresults: selectedTypes.length > 0 ? false : true
    });
    this.applyUrlParams();
    this.handleSortChange();
    this.filterProducts();
  }

  nextProduct = (change) => {
    let highlightedProductIndex = this.state.productResult.indexOf(this.state.highlightedProduct);
    let newHighlightedProduct = this.state.productResult[highlightedProductIndex + change] ?? null;
    this.setGraph(null, null);
    if (newHighlightedProduct) {
      this.setGraph(newHighlightedProduct.Id);
    }
  }

  async setGraph(productId) {
    if (productId === null || productId === this.state.highlightedProduct.Id) {
      this.setState({ highlightedProduct: false, graphIsVisible: false });
      this.onbackPress();
    } else {
      this.setUrlParams("product", productId);
      let product = this.state.loadedProducts.find((p) => p.Id === productId);

      if (product === undefined) {
        product = await this.spritjaktClient.FetchProductById(productId);
      }
      this.setState({ highlightedProduct: product, graphIsVisible: true });
    }
  };
  selectAllTypes = (resetUrlParams = true) => {
    let productTypes = this.state.productTypes;
    Object.keys(this.state.productTypes).map(
      (pt) => (productTypes[pt].state = false)
    );
    this.setState({
      productTypes: productTypes,
      showAllresults: true,
    });
    if (resetUrlParams) {
      this.setUrlParams("filter", null);
    }
    this.filterProducts();
  };

  handleFilterClick = (isSelected, name) => {
    let productTypes = this.state.productTypes;
    productTypes[name].state = isSelected;
    let activeProductTypes = Object.keys(productTypes).filter(pt => productTypes[pt].state);
    this.setUrlParams("filter", activeProductTypes);
    this.filterProducts(this.state.selectedStores, productTypes);
  };

  async filterProducts(selectedStores = this.state.selectedStores, productTypes = this.state.productTypes) {
    let productResult = [];
    let prevSelectedProductTypes = Object.keys(productTypes).filter(pt => productTypes[pt].state) ?? [];


    for (let i = 0; i < this.state.loadedProducts.length; i++) {
      const p = this.state.loadedProducts[i];

      if (this.stockFilter(p, selectedStores)) {
        if (prevSelectedProductTypes.includes(p.SubType) || prevSelectedProductTypes.length === 0) {
          productResult.push(p);
        }
        productTypes[p.SubType].products[p.Id] = true;
      }
    }

    await this.setState({
      productResult: productResult,
      page: this.state.page > Math.ceil(productResult.length / this.state.pageSize) ? 1 : this.state.page,
      productTypes: productTypes,
      selectedStores: selectedStores,
      showAllresults: Object.keys(productTypes).find(pt => productTypes[pt].state) ? false : true
    });
    this.createFilter();
  }

  displayProducts = () => {
    let productResult = this.state.productResult;
    let productDisplay = [];
    let startPoint = productResult.length > this.state.pageSize ? this.state.pageSize * (this.state.page - 1) : 0;
    for (let i = startPoint; i < productResult.length; i++) {
      const p = productResult[i];
      if (productDisplay.length < this.state.pageSize) {
        productDisplay.push(
          <ProductComp key={p.Id} showDiff={true} product={p} notification={this.Notification} selectedStores={this.state.selectedStores} setGraph={this.setGraph.bind(this)} />
        );
      }
    }
    return productDisplay;
  }

  displayProductTypes = () => {
    let list = [];
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).forEach((ptKey) => {
      list.push(
        <ProductType key={ptKey} store={this.state.selectedStores} handleFilterClick={this.handleFilterClick.bind(this)} name={ptKey} productType={productTypes[ptKey]}
        />
      );
    });
    SortArray(list, {
      by: "key"
    })
    return list;
  };

  formatDate = (date) => {
    date.setHours(date.getHours() + 2);
    return date.toISOString().slice(0, 10);
  };

  async handleStoreUpdate(storeList) {
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).map(pt => productTypes[pt].products = {});
    this.setState({
      storeList: storeList,
      productTypes: productTypes
    });
    this.setUrlParams("stores", storeList);
    this.filterProducts(storeList, productTypes);
  };

  handleSortChange = (event) => {

    let option = this.state.sort;
    if (event && event.target) {
      option = event.target.value;
    }
    this.setUrlParams("sort", option);
    let sortingCriteria = option.split("_");
    let sortField = sortingCriteria[0];
    let sortOrder = sortingCriteria[1];

    if (sortField === "SortingDiscount") {
      sortOrder = this.state.change === "raised" ? "desc" : "asc";
    }

    let list = this.state.loadedProducts;

    SortArray(list, {
      by: [sortField, "Name"],
      order: [sortOrder, "asc"],
    });
    this.setState({
      loadedProducts: list,
      sort: option
    });
    this.filterProducts();
  };

  setDiscountFilter = async (event) => {
    let value = "all";
    if (event.target.value) {
      value = event.target.value;
    }
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).forEach(pt => {
      productTypes[pt].products = {};
      productTypes[pt].state = false;
    });
    await this.setState({
      change: value,
      loading: true,
      timeSpan: 7,
    });
    this.resetUrlParams();
    this.setUrlParams("change", value);
    this.getProductData(7, true);
  }

  stockFilter = (p, selectedStores) => {
    let isOnline = undefined;

    if (selectedStores.includes("online")) {
      isOnline = !(p.ProductStatusSaleName && ["Midlertidig utsolgt", "Utsolgt", "Utgått"].includes(p.ProductStatusSaleName));
    }

    if (isOnline || (selectedStores.includes("0") || p.Stock.Stores.find((s) => selectedStores.includes(s.name)))) {
      return true;
    }

    return false;
  }

  changeTimeSpan = (event) => {
    if (!event) return;
    let option = event.target.value;

    this.setState({ timeSpan: option, loading: true });
    this.setUrlParams("timespan", option);
    this.getProductData(option);
  };

  setPage = (page) => {
    this.setState({ page: page });
    this.setUrlParams("page", page);
  };
  render() {

    let { currentFilterExists, loading, pageSize, page, productResult, stores, selectedStores, filter, user } = this.state;

    return (
      <div key="Productlist" className="Productlist" >

        <div className="filterSaverWrapper">
          {(!currentFilterExists && !loading && filter && (filter.productTypes.length > 0 || filter.stores.length > 0)) &&
            <div className="filterSaver">
              <button className="bigGoldBtn clickable" onClick={(e) => { this.SaveUserFilter(e) }}>Lagre filter</button>
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
        </div>

        <div className="main">
          <aside className={"filter " + (this.state.filterVisibility ? "active" : "inactive")}>
            <button className="toggleFilter"
              onClick={() => {
                this.setState({
                  filterVisibility: !this.state.filterVisibility,
                });
              }}>
              {!this.state.filterVisibility ? ("Filter") : (<FontAwesomeIcon title="Lukk filter" icon={faTimes} />)}
            </button>
            <fieldset disabled={!this.state.filterVisibility && isMobileOnly}>
              <button disabled={this.state.showAllresults}
                className={"clickable bigGreenBtn resetFilter show " + (this.state.showAllresults ? "inactive" : "active")}
                onClick={() => this.selectAllTypes()}>
                Nullstill
              </button>
              <div className="ProductTypes">{this.displayProductTypes()}</div>
            </fieldset>
          </aside>
          <main>
            <div className="before_products">
              <div className="nav">
                <div className="DiscountFilter">
                  <a
                    className={"clickable " + (this.state.change === "lowered" ? "active" : "")}
                    href={"?change=lowered"}
                  >Ned i pris</a>
                  <a
                    className={"clickable " + (this.state.change === "raised" ? "active" : "")}
                    href={"?change=raised"}
                  >Opp i pris</a>
                </div>
                {this.state.stores.length > 0 &&
                  <StoreSelector handleStoreUpdate={this.handleStoreUpdate.bind(this)} change={this.state.change} selectedStores={selectedStores} stores={stores} />
                }
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
                <div className="timeSpan">
                  <label htmlFor="timespan">Tidsperiode
                <Select
                      native
                      value={this.state.timeSpan}
                      onChange={this.changeTimeSpan}
                      inputProps={{
                        name: 'timeSpan',
                        id: 'timeSpan',
                      }}
                    >
                      {this.timeSpanOptions.map(option => (
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
            />
            <ul className="ProductList">
              {this.state.loading ?
                <FontAwesomeIcon icon={faCircleNotch} size="5x" />
                :
                this.displayProducts()}
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
            />
            <ProductPopUp product={this.state.highlightedProduct} notification={this.Notification} graphIsVisible={this.state.graphIsVisible} nextProduct={this.nextProduct.bind(this)} setGraph={this.setGraph.bind(this)} />
            <div
              className={
                "filter_backdrop " +
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
