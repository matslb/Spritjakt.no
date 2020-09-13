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
import { isMobile } from "react-device-detect";
import firebase from "firebase/app";
import "firebase/analytics";
import StoreSelector from "./StoreSelector";

class ProductList extends React.Component {
  constructor() {
    super();
    this.state = {
      loadedProducts: [],
      stores: [],
      stockFilter: "all",
      selectedStores: ["0"],
      loading: true,
      sort: "LastUpdated_desc",
      productTypes: {},
      showAllresults: true,
      highlightedProduct: false,
      graphIsVisible: false,
      timeSpan: "14days",
      productResult: [],
      page: 1,
      pageSize: 24,
      discountFilter: "lowered",
      filterVisibility: false,
    };
    this.productButtonRef = React.createRef();
    this.productList = React.createRef();
  }

  async componentDidMount() {
    this.updateProductResults(this.state.timeSpan, true);
  }

  async updateProductResults(timeSpan, firstLoad = false) {
    let stores = this.state.stores;
    if (firstLoad) {
      stores = await SpritjaktClient.FetchStores();
      SortArray(stores, {
        by: ["city", "storeName"],
        computed: {
          city: s => s.address.city
        }
      });
    }
    stores.map(s => delete s.count);

    let products = await SpritjaktClient.FetchProducts(timeSpan);

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
        stores.map(s => {
          if (s.storeId === store.name) {
            if (s.count === undefined) {
              s.count = {};
            }
            if (priceisLower) {
              s.count.lowered = s.count.lowered === undefined ? 1 : s.count.lowered + 1;
            } else {
              s.count.raised = s.count.raised === undefined ? 1 : s.count.raised + 1;
            }
            return;
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
    Object.keys(productTypes).map((pt) => {
      productTypes[pt].state = false;
    });

    for (let i = 0; i < this.state.loadedProducts.length; i++) {
      const p = this.state.loadedProducts[i];
      if ((selectedStores.includes("0") || p.Stock.Stores.find((s) => selectedStores.includes(s.name))) &&
        this.stockFilter(p) && this.filterOnDiscount(p)) {
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
    Object.keys(productTypes).map((ptKey) => {
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

  handleSortChange = (event = undefined) => {
    let sorting = this.state.sort.split("_");
    if (event !== undefined) {
      sorting = event.target.value.split("_");
      firebase.analytics().logEvent("product_sort", { value: event.target.value });
    }

    let sortState;
    if (sorting[0] === "SortingDiscount") {
      sorting[1] = this.state.discountFilter === "raised" ? "desc" : "asc";
      sortState = sorting[0];
    } else {
      sortState = sorting[0] + "_" + sorting[1];
    }

    this.setState({
      sort: sortState
    });
    let list = this.state.loadedProducts;

    SortArray(list, {
      by: [sorting[0], "Name"],
      order: [sorting[1], "asc"],
    });
    this.setState({
      loadedProducts: list
    });
    this.filterProducts();
  };

  handleStockChange = async (event) => {
    await this.setState({ stockFilter: event.target.value });
    this.filterProducts();
  }

  filterOnDiscount = (p, discountFilter = this.state.discountFilter) => {
    switch (discountFilter) {
      case "raised":
        return p.SortingDiscount > 100
        break;
      case "lowered":
        return p.SortingDiscount < 100
        break;
      default:
        return true;
        break;
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
      productTypes: productTypes
    });
    this.handleSortChange();
  }

  stockFilter = (p) => {
    let stockTypes = ["Midlertidig utsolgt", "Utgått"];
    switch (this.state.stockFilter) {
      case "online":
        if (p.ProductStatusSaleName && stockTypes.includes(p.ProductStatusSaleName)) {
          return false;
        }
        break;
      case "instock":
        if (p.Stock.Stores.length === 0) {
          return false;
        }
        break;

      default:
        break;
    }
    return true;
  }

  changeTimeSpan = (event) => {
    this.setState({ timeSpan: event.target.value, loading: true });

    firebase.analytics().logEvent("timespan_change", { value: event.target.value });

    this.updateProductResults(event.target.value);
  };

  setPage = (page) => {
    this.setState({ page: page });
    Scroll.animateScroll.scrollTo(this.productList.current.offsetTop - 100);
  };
  render() {

    let { pageSize, page, productResult, stores } = this.state;

    return (
      <div key="Productlist" className="main">
        <div className="before_products">
          <div className="nav">
            <div className="DiscountFilter">
              <button
                className={"clickable " + (this.state.discountFilter === "lowered" ? "active" : "")}
                value="lowered"
                onClick={this.setDiscountFilter}
              >Ned i pris</button>
              <button
                className={"clickable " + (this.state.discountFilter === "all" ? "active" : "")}
                value="all"
                onClick={this.setDiscountFilter}
              >Alle</button>
              <button
                className={"clickable " + (this.state.discountFilter === "raised" ? "active" : "")}
                value="raised"
                onClick={this.setDiscountFilter}
              >Opp i pris</button>
            </div>
            <div
              className={
                "filter " +
                (this.state.filterVisibility ? "active" : "inactive")
              }
            >
              <button
                className="toggleFilter"
                onClick={() => {
                  this.setState({
                    filterVisibility: !this.state.filterVisibility,
                  });
                  firebase.analytics().logEvent("filter_toggle_handheld");
                }}
              >
                {!this.state.filterVisibility ? (
                  "Filter"
                ) : (
                    <FontAwesomeIcon title="Lukk filter" icon={faTimes} />
                  )}
              </button>
              <fieldset disabled={!this.state.filterVisibility && isMobile}>
                <legend>Filter</legend>
                <button
                  disabled={this.state.showAllresults}
                  className={
                    "clickable resetFilter show " +
                    (this.state.showAllresults ? "inactive" : "active")
                  }
                  onClick={() => this.selectAllTypes()}
                >
                  Nullstill
                </button>
                <div className="ProductTypes">{this.displayProductTypes()}</div>
              </fieldset>
            </div>
            <div className="sorting">
              <label htmlFor="sorting">Sortering</label>
              <br />
              <select
                id="sorting"
                value={this.state.sort}
                onChange={this.handleSortChange}>
                <option value="LastUpdated_desc">Nyeste</option>
                <option value="SortingDiscount">Prisendring</option>
                <option value="Name_asc">Navn (A-Å)</option>
                <option value="Name_desc">Navn (Å-A)</option>
                <option value="LatestPrice_asc">Pris (lav-høy)</option>
                <option value="LatestPrice_desc">Pris (høy-lav)</option>
              </select>
            </div>
            <div className="stock">
              <label htmlFor="stock">Lagerstatus</label>
              <br />
              <select
                id="stock"
                value={this.state.stockFilter}
                onChange={this.handleStockChange}>
                <option value="all">Alle</option>
                <option value="online">Kan bestilles på nett</option>
                <option value="instock">På lager i butikk</option>
              </select>
            </div>
            {this.state.stores.length > 0 &&
              <StoreSelector handleStoreUpdate={this.handleStoreUpdate.bind(this)} discountFilter={this.state.discountFilter} stores={stores} />
            }

            <div className="timeSpan">
              <label htmlFor="timespan">Tidsperiode</label>
              <br />
              <select
                id="timespan"
                value={this.state.timeSpan}
                onChange={this.changeTimeSpan}>
                <option value="7days">Siste 7 dager</option>
                <option value="14days">Siste 14 dager</option>
                <option value="30days">Siste 30 dager</option>
                <option value="90days">Siste 90 dager</option>
              </select>
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
      </div>
    );
  }
}

export default ProductList;
