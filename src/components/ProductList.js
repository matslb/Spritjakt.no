import React from "react";
import ProductComp from "./ProductComp";
import ProductType from "./FilterItem";
import Pagination from "./Pagination";
import "./css/productList.css";
import SpritjaktClient from "../services/spritjaktClient";
import { faCircleNotch, faMinus, faPlus, faTimes } from "@fortawesome/free-solid-svg-icons";
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
      selectedStores: [],
      loading: true,
      sort: "LastUpdated_desc",
      productTypes: {},
      productCountries: {},
      highlightedProduct: false,
      graphIsVisible: false,
      timeSpan: 1,
      productResult: [],
      page: 1,
      pageSize: 24,
      change: "lowered",
      filterVisibility: false,
      user: null,
      urlParameters: {},
      filterName: "",
      filter: {
        productTypes: [],
        stores: [],
        countries: []
      }
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
    this.timeSpanOptions = [
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

  applyUrlParams = (urlParameters = this.state.urlParameters) => {
    this.setState({ urlParameters: urlParameters });
    Object.keys(urlParameters).forEach(field => {
      const param = urlParameters[field];
      switch (field) {
        case "product":
          this.setGraph(param);
          break;
        case "types":
          if (Array.isArray(param)) {
            param.forEach(id => {
              if (this.state.productTypes && this.state.productTypes[id]) {
                this.handleFilterClick(true, id, this.state.productTypes, "types");
              }
            })
          } else {
            if (this.state.productTypes && this.state.productTypes[param]) {
              this.handleFilterClick(true, param, this.state.productTypes, "types");
            };
          }
          break;
        case "countries":
          if (Array.isArray(param)) {
            param.forEach(id => {
              if (this.state.productCountries && this.state.productCountries[id]) {
                this.handleFilterClick(true, id, this.state.productCountries, "countries");
              }
            })
          } else {
            if (this.state.productCountries && this.state.productCountries[param]) {
              this.handleFilterClick(true, param, this.state.productCountries, "countries");
            };
          }
          break;
        case "page":
          this.setPage(parseInt(param));
          break;
        case "stores":
          if (Array.isArray(param)) {
            this.filterProducts(param);
          } else {
            this.filterProducts([param]);
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
                    products: {},
                    state: false,
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
      let query = queryString.parse(window.location.search, { arrayFormat: 'comma' });
      this.applyUrlParams(query);
      this.getProductData(query.timespan == undefined);
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

  createFilter(selectedStores = this.state.selectedStores) {
    let productTypesInFilter = [];
    Object.keys(this.state.productTypes).forEach(pt => {
      if (this.state.productTypes[pt].state) {
        productTypesInFilter.push(pt);
      }
    })
    let countries = [];
    Object.keys(this.state.productCountries).forEach(pt => {
      if (this.state.productCountries[pt].state) {
        countries.push(pt);
      }
    })

    if (!Array.isArray(selectedStores)) {
      selectedStores = [selectedStores];
    }

    let newFilter = {
      productTypes: productTypesInFilter,
      stores: selectedStores,
      countries: countries
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

  getProductData(autoFetch = false) {
    const change = this.state.change;
    this.spritjaktClient.FetchProducts(this.state.timeSpan, change === "lowered").then(products => this.updateProductResults(products, autoFetch));
  }

  updateProductResults(products, autoFetch = false) {
    if (products === undefined) {
      return;
    }
    let loadedProducts = [];
    let productTypes = this.state.productTypes || {};
    let productCountries = this.state.productCountries || {};
    let stores = this.state.stores;

    stores.map(s => delete s.count);

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
          state: false,
          products: {}
        };
      }
      if (productCountries[p.Country] === undefined) {
        productCountries[p.Country] = {
          state: false,
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
        const store = p.Stock.Stores[i];
        stores.forEach(s => {
          if (s.storeId === store.pointOfService.name) {
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
      productCountries: productCountries,
      loading: false
    });
    this.applyUrlParams();
    this.handleSortChange();

    if (autoFetch && loadedProducts.length < 200) {
      let timespanIndex = this.timeSpanOptions.indexOf(this.timeSpanOptions.find(ts => ts.value === this.state.timeSpan)) + 1;
      if (this.timeSpanOptions[timespanIndex]) {
        this.changeTimeSpan(null, this.timeSpanOptions[timespanIndex].value, autoFetch);
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
    this.filterProducts([], productTypes, productCountries);
  };

  resetFilterUrl = () => {
    this.setUrlParams("stores", null);
    this.setUrlParams("types", null);
    this.setUrlParams("countries", null);
  }

  handleFilterClick = (isSelected, id, allProps, propSlug) => {
    allProps[id].state = isSelected;
    let activeProps = Object.keys(allProps).filter(p => allProps[p].state);
    this.setUrlParams(propSlug, activeProps);
  };

  handleCountryFilterClick = (isSelected, id) => {
    this.handleFilterClick(isSelected, id, this.state.productCountries, "countries");
    this.filterProducts();
  };
  handleTypeFilterClick = (isSelected, id) => {
    this.handleFilterClick(isSelected, id, this.state.productTypes, "types");
    this.filterProducts();
  };

  filterProducts(selectedStores = [], productTypes = this.state.productTypes, productCountries = this.state.productCountries) {
    let productResult = [];
    let query = queryString.parse(window.location.search, { arrayFormat: 'comma' });
    selectedStores = query?.stores || selectedStores;
    Object.keys(productTypes).map(pt => {
      productTypes[pt].state = query.types?.includes(pt) || false;
      productTypes[pt].products = {}
    });
    Object.keys(productCountries).map(c => {
      productCountries[c].state = query.countries?.includes(c) || false;
      productCountries[c].products = {}
    });

    for (let i = 0; i < this.state.loadedProducts.length; i++) {
      const p = this.state.loadedProducts[i];

      if (this.storeFilter(p, selectedStores)) {
        productTypes[p.SubType].products[p.Id] = true;
        if (query.types?.includes(p.SubType) || query.types === undefined) {
          productCountries[p.Country].products[p.Id] = true;
          if ((query.countries?.includes(p.Country) || query.countries === undefined)) {
            productResult.push(p);
          }
        }
      }
    }

    this.setState({
      productResult: productResult,
      page: this.state.page > Math.ceil(productResult.length / this.state.pageSize) ? 1 : this.state.page,
      productTypes: productTypes,
      productCountries: productCountries,
      selectedStores: selectedStores
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
          <ProductComp key={p.Id} showDiff={true} product={p} notification={this.Notification} selectedStores={this.state.selectedStores} setGraph={this.setGraph.bind(this)} />
        );
      }
    }
    return productDisplay;
  }

  displayProductTypes = () => {
    let list = [];
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).forEach((key) => {
      list.push(
        <ProductType key={key} handleFilterClick={this.handleTypeFilterClick.bind(this)} name={key} item={productTypes[key]}
        />
      );
    });
    SortArray(list, {
      by: "key"
    })
    return list;
  };

  displayProductCountries = () => {
    let list = [];
    let countries = this.state.productCountries;
    Object.keys(countries).forEach((key) => {
      list.push(
        <ProductType key={key} handleFilterClick={this.handleCountryFilterClick.bind(this)} name={key} item={countries[key]}
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

  handleStoreUpdate(storeList) {
    this.setUrlParams("stores", storeList);
    this.filterProducts(storeList);
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

    SortArray(list, {
      by: [sortField, "Discount"],
      order: [sortOrder, discountOrder],
    });

    this.setState({
      loadedProducts: list,
      sort: option
    }, () => this.filterProducts(this.state.selectedStores, this.state.productTypes));
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
      timeSpan: option,
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
  };
  render() {

    let {
      currentFilterExists,
      loading,
      pageSize,
      page,
      productResult,
      stores,
      selectedStores,
      filter,
      user,
      showCountries = true,
      showTypes = true
    } = this.state;

    return (
      <div key="Productlist" className="Productlist" >

        <div className="filterSaverWrapper">
          {(!currentFilterExists && !loading && filter && (filter.productTypes.length > 0 || filter.stores.length > 0)) &&
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
              <button disabled={filter.stores.length === 0 && filter.productTypes.length === 0 && filter.countries.length === 0}
                className={"clickable bigGreenBtn resetFilter show " + (filter.stores.length === 0 && filter.productTypes.length === 0 && filter.countries.length === 0 ? "inactive" : "active")}
                onClick={() => { this.resetFilterUrl(); this.resetFilter(); }}>
                Nullstill
              </button>
              <h4 className="dark filter-heading" onClick={() => { this.setState({ showTypes: !showTypes }) }}>
                Type <FontAwesomeIcon title="Ekspandér produkttyper" icon={showTypes ? faMinus : faPlus} />
              </h4>
              <div className={"filter-items " + (showTypes ? "visible" : "hidden")}>{this.displayProductTypes()}</div>
              <h4 className="dark filter-heading" onClick={() => { this.setState({ showCountries: !showCountries }) }}>
                Land <FontAwesomeIcon title="Ekspandér produktland" icon={showCountries ? faMinus : faPlus} />
              </h4>
              <div className={"filter-items " + (showCountries ? "visible" : "hidden")} >{this.displayProductCountries()}</div>
            </fieldset>
          </aside>
          <main>
            <div className="before_products">
              <div className="nav">
                <div className="DiscountFilter">
                  <a
                    className={"clickable " + (this.state.change === "lowered" ? "active" : "")}
                    href={"/"}
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
              loading={this.state.loading}
            />
            <ul className="ProductList">
              {loading && productResult.length === 0 &&
                <div className="prouctList-loader">
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
