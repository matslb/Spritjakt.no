import React from "react";
import { CSSTransition } from "react-transition-group";
import ProductComp from "./ProductComp";
import ProductType from "./ProductType";
import Pagination from "./Pagination";
import "./css/productList.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import { faCircleNotch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SortArray from "sort-array";
import PriceGraph from "./PriceGraph";
import * as Scroll from "react-scroll";
import { isMobileOnly } from "react-device-detect";
import firebase from "firebase/app";
import "firebase/analytics";
import StoreSelector from "./StoreSelector";
import Select from 'react-select'


class ProductList extends React.Component {
  constructor() {
    super();
    this.state = {
      loadedProducts: [],
      stores: [],
      stockFilter: { label: "Alle", value: "all" },
      selectedStores: ["0"],
      loading: true,
      sort: { label: "Nyeste", value: "LastUpdated_desc" },
      productTypes: {},
      showAllresults: true,
      highlightedProduct: false,
      graphIsVisible: false,
      timeSpan: { label: "Siste 14 dager", value: 14 },
      productResult: [],
      page: 1,
      pageSize: 24,
      discountFilter: "lowered",
      filterVisibility: false,
    };
    this.spritjaktClient = new SpritjaktClient();
    this.productButtonRef = React.createRef();
    this.productList = React.createRef();
  }

  async componentDidMount() {
    this.updateProductResults(this.state.timeSpan.value, true);
  }

  async updateProductResults(timeSpan, firstLoad = false) {
    let stores = this.state.stores;
    if (firstLoad) {
      stores = await this.spritjaktClient.FetchStores();
      SortArray(stores, {
        by: ["city", "storeName"],
        computed: {
          city: s => s.address.city
        }
      });
    }
    stores.map(s => delete s.count);

    let products = await this.spritjaktClient.FetchProducts(timeSpan, this.state.discountFilter === "lowered");

    this.setState({ loading: false, page: 1 });

    let loadedProducts = [];
    let productTypes = this.state.productTypes;
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
      let priceisLower = this.filterOnDiscount(p, "lowered");
      for (const i in p.Stock.Stores) {
        const store = p.Stock.Stores[i];
        stores.forEach(s => {
          if (s.storeId === store.name) {
            if (s.count === undefined) {
              s.count = {};
            }
            if (priceisLower) {
              s.count.lowered = s.count.lowered === undefined ? 1 : s.count.lowered + 1;
            } else {
              s.count.raised = s.count.raised === undefined ? 1 : s.count.raised + 1;
            }
          }
        });
      }
    });

    let selectedTypes = Object.keys(productTypes).filter((pt) => {
      return productTypes[pt].state;
    });

    await this.setState({
      stores: stores,
      loadedProducts: loadedProducts,
      productTypes: productTypes,
      showAllresults: selectedTypes.length > 0 ? false : true,

    });
    this.handleSortChange();
    this.filterProducts();
  }

  hideGraph = () => {
    this.setState({ graphIsVisible: false });
  };
  setGraph = (productId, productButton) => {
    if (productId === null || productId === this.state.highlightedProduct.Id) {
      this.setState({ highlightedProduct: false, graphIsVisible: false });
      this.productButtonRef.current.focus();
    } else {
      this.productButtonRef = productButton;
      let product = this.state.loadedProducts.find((p) => p.Id === productId);
      this.setState({ highlightedProduct: product, graphIsVisible: true });
      firebase.analytics().logEvent("select_item", {
        items: [product],
        item_list_name: "Main Products list",
        item_list_id: 1,
      });
    }
  };

  selectAllTypes = () => {
    let productTypes = this.state.productTypes;
    Object.keys(this.state.productTypes).map(
      (pt) => (productTypes[pt].state = false)
    );
    this.setState({
      productTypes: productTypes,
      showAllresults: true,
    });
    this.filterProducts();
  };

  handleFilterClick = (isSelected, name) => {
    let productTypes = this.state.productTypes;
    productTypes[name].state = isSelected;

    firebase.analytics().logEvent("filter_click", { value: productTypes[name] });
    this.filterProducts(this.state.selectedStores, productTypes);
  };

  filterProducts = (selectedStores = this.state.selectedStores, productTypes = this.state.productTypes) => {
    let productResult = [];
    let prevSelectedProductTypes = Object.keys(productTypes).filter(pt => productTypes[pt].state) ?? [];
    Object.keys(productTypes).forEach((pt) => {
      productTypes[pt].state = false;
    });

    for (let i = 0; i < this.state.loadedProducts.length; i++) {
      const p = this.state.loadedProducts[i];
      if (this.stockFilter(p, selectedStores) && this.filterOnDiscount(p)) {
        if (prevSelectedProductTypes.includes(p.SubType) || prevSelectedProductTypes.length === 0) {
          productResult.push(p);
        }
        productTypes[p.SubType].products[p.Id] = true;

        if (prevSelectedProductTypes.includes(p.SubType)) {
          productTypes[p.SubType].state = true;
        }
      }
    }

    this.setState({
      productResult: productResult,
      productTypes: productTypes,
      selectedStores: selectedStores,
      showAllresults: Object.keys(productTypes).find(pt => productTypes[pt].state) ? false : true
    });
  }

  displayProducts = () => {
    let productResult = this.state.productResult;
    let productDisplay = [];
    let startPoint = productResult.length > this.state.pageSize ? this.state.pageSize * (this.state.page - 1) : 0;
    for (let i = startPoint; i < productResult.length; i++) {
      const p = productResult[i];
      if (productDisplay.length < this.state.pageSize) {
        productDisplay.push(
          <ProductComp key={p.Id} showDiff={true} product={p} selectedStore={"0"} setGraph={this.setGraph.bind(this)} />
        );
      }
    }
    return productDisplay;
  }

  displayProductTypes = () => {
    let list = [];
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).forEach((ptKey) => {
      if (Object.keys(productTypes[ptKey].products).length !== 0)
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

  handleStoreUpdate = async (storeList) => {
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).map(pt => productTypes[pt].products = {})
    this.setState({
      storeList: storeList,
      productTypes: productTypes
    });
    this.filterProducts(storeList, productTypes);
  };

  handleSortChange = (option = this.state.sort) => {
    firebase.analytics().logEvent("product_sort", { value: option.value });
    let sortingCriteria = option.value.split("_");
    let sortField = sortingCriteria[0];
    let sortOrder = sortingCriteria[1];

    if (sortField === "SortingDiscount") {
      sortOrder = this.state.discountFilter === "raised" ? "desc" : "asc";
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

  handleStockChange = async (option) => {
    await this.setState({ stockFilter: option });
    this.filterProducts();
  }

  filterOnDiscount = (p, discountFilter = this.state.discountFilter) => {
    switch (discountFilter) {
      case "raised":
        return p.SortingDiscount > 100
      case "lowered":
        return p.SortingDiscount < 100
      default:
        return true;
    }
  }

  setDiscountFilter = async (event) => {
    let value = "all";
    if (event.target.value) {
      value = event.target.value;
    }
    let productTypes = this.state.productTypes;
    Object.keys(productTypes).map(pt => productTypes[pt].products = {})
    await this.setState({
      discountFilter: value,
      loading: true,
      timeSpan: { label: "Siste 14 dager", value: 14 }
    });
    this.updateProductResults(14);
  }

  stockFilter = (p, selectedStores) => {
    let isOnline = undefined;

    if (selectedStores.includes("online")) {
      isOnline = !(p.ProductStatusSaleName && ["Midlertidig utsolgt", "Utgått"].includes(p.ProductStatusSaleName));
    }

    if (isOnline || (selectedStores.includes("0") || p.Stock.Stores.find((s) => selectedStores.includes(s.name)))) {
      return true;
    }

    return false;
  }

  changeTimeSpan = (option) => {
    this.setState({ timeSpan: option, loading: true });
    firebase.analytics().logEvent("timespan_change", { value: option.value });
    this.updateProductResults(option.value);
  };

  setPage = (page) => {
    this.setState({ page: page });
    Scroll.animateScroll.scrollTo(this.productList.current.offsetTop - 100);
  };
  render() {

    let { pageSize, page, productResult, stores } = this.state;

    return (
      <div key="Productlist" className="main">
        <aside className={"filter " + (this.state.filterVisibility ? "active" : "inactive")}>
          <button className="toggleFilter"
            onClick={() => {
              this.setState({
                filterVisibility: !this.state.filterVisibility,
              });
              firebase.analytics().logEvent("filter_toggle_handheld");
            }}>
            {!this.state.filterVisibility ? ("Filter") : (<FontAwesomeIcon title="Lukk filter" icon={faTimes} />)}
          </button>
          <fieldset disabled={!this.state.filterVisibility && isMobileOnly}>
            <button disabled={this.state.showAllresults}
              className={"clickable resetFilter show " + (this.state.showAllresults ? "inactive" : "active")}
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
                <button
                  className={"clickable " + (this.state.discountFilter === "lowered" ? "active" : "")}
                  value="lowered"
                  onClick={this.setDiscountFilter}
                >Ned i pris</button>
                <button
                  className={"clickable " + (this.state.discountFilter === "raised" ? "active" : "")}
                  value="raised"
                  onClick={this.setDiscountFilter}
                >Opp i pris</button>
              </div>
              {this.state.stores.length > 0 &&
                <StoreSelector handleStoreUpdate={this.handleStoreUpdate.bind(this)} discountFilter={this.state.discountFilter} stores={stores} />
              }
              <div className="sorting">

                <label htmlFor="sorting">Sortering
                <Select
                    value={this.state.sort}
                    className="select"
                    onChange={this.handleSortChange}
                    options={[
                      { label: "Nyeste", value: "LastUpdated_desc" },
                      { label: "Prisendring", value: "SortingDiscount" },
                      { label: "Navn (A-Å)", value: "Name_asc" },
                      { label: "Navn (Å-A)", value: "Name_desc" },
                      { label: "Pris (lav-høy)", value: "LatestPrice_asc" },
                      { label: "Pris (høy-lav)", value: "LatestPrice_desc" }
                    ]}
                    noOptionsMessage={() => ""}
                    placeholder={'Sortering'}
                    autosize={true}
                    classNamePrefix="noinput select"
                    components={null}
                    theme={theme => ({
                      ...theme,
                      colors: {
                        ...theme.colors,
                        primary: '#d0b55e',
                      },
                    })}
                  />
                </label>
              </div>
              <div className="timeSpan">
                <label htmlFor="timespan">Tidsperiode
                <Select
                    value={this.state.timeSpan}
                    onChange={this.changeTimeSpan}
                    options={[
                      { label: "Siste 7 dager", value: 7 },
                      { label: "Siste 14 dager", value: 14 },
                      { label: "Siste 30 dager", value: 30 },
                      { label: "Siste 90 dager", value: 90 }
                    ]}
                    noOptionsMessage={() => ""}
                    placeholder={'Tidsperiode'}
                    classNamePrefix="noinput select"
                    theme={theme => ({
                      ...theme,
                      colors: {
                        ...theme.colors,
                        primary: '#d0b55e',
                      },
                    })}
                  />
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
          <ul ref={this.productList} className="ProductList">
            {this.state.loading ? <FontAwesomeIcon icon={faCircleNotch} size="5x" /> : this.displayProducts()}
            {productResult.length === 0 && this.state.loading === false ? (
              <p
                style={{
                  textAlign: "center",
                  position: "absolute",
                  left: 0,
                  right: 0,
                  margin: "auto"
                }}
              >Her var det ikke noe, gitt :/</p>) : ("")}
          </ul>
          <Pagination
            total={productResult.length}
            page={page}
            setPage={this.setPage.bind(this)}
            pageSize={pageSize}
          />
          <CSSTransition
            in={this.state.graphIsVisible}
            timeout={100}
            className="toggle"
            onExited={() => this.setGraph(null, null)}
          >
            <div>
              {this.state.highlightedProduct && (
                <div className="priceGraphWrapper">
                  <PriceGraph p={this.state.highlightedProduct} />
                  <div className="backdrop" onClick={() => this.hideGraph()}>
                    <label htmlFor="closeGraph">Tilbake</label>
                    <button name="closeGraph" className="close">
                      <FontAwesomeIcon icon={faTimes} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </CSSTransition>
          <div
            className={
              "filter_backdrop " +
              (this.state.filterVisibility ? "active" : "inactive")
            }
            onClick={() => this.setState({ filterVisibility: false })}
          ></div>
        </main>

      </div>
    );
  }
}

export default ProductList;
