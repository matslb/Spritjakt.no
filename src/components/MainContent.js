import * as React from 'react';
import Pagination from "./Pagination";
import "./css/mainContent.css";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ProductPopUp from "./ProductPopUp";
import firebase from "firebase/compat/app";
import StoreSelector from "./StoreSelector";
import { NativeSelect, SwipeableDrawer } from '@mui/material';
import queryString from "query-string";
import Notification from "./Notification";
import Filter from "./Filter";
import SearchBar from "./SearchBar";
import ProductList from "./ProductList";
import { arraysAreEqual, cleanForMissingStores, isInViewport, toArray } from "../utils/utils.js";
import TypeSenseClient from "../services/typeSenseClient";
import roundLogo from "../assets/round-logo.svg";
import SpritjaktClient from "../services/spritjaktClient";

import { sortOptions } from "../utils/utils.js";
import SavedFilterList from "./SavedFilterList";
import { isMobile } from 'react-device-detect';

class MainContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      stores: [],
      loading: true,
      sort: "LastUpdated_desc",
      productTypes: {},
      isGoodFor: [],
      productCountries: {},
      highlightedProduct: null,
      productResult: [],
      page: 1,
      pageSize: 20,
      user: null,
      isSearch: false,
      currentFilterExists: true,
      searchString: "",
      forceSearchString: false,
      anchor: false,
      filter: {
        productTypes: [],
        stores: [],
        countries: [],
        isGoodFor: []
      },
      sortOptions: sortOptions
    };

    this.typeSenseClient = new TypeSenseClient();
    this.notification = React.createRef();
  }

  toggleDrawer = (anchor, open) => (event) => {
    if (
      event &&
      event.type === 'keydown' &&
      (event.key === 'Tab' || event.key === 'Shift')
    ) {
      return;
    }
    this.setState({ anchor: open });
  }

  setUrlParams = (field, value = null) => {
    let urlParameters = this.getQuery();
    urlParameters[field] = value;

    if (value === null) {
      delete urlParameters[field];
    }

    let query = queryString.stringify(urlParameters, { arrayFormat: 'comma' });
    if (field === "product" && value !== null) {
      window.history.replaceState('', '', '?' + query);
    }
    window.history.replaceState('', '', '?' + query);
  }

  applyUrlParams = (urlParameters = this.getQuery()) => {
    this.setState({ urlParameters: urlParameters }, () => {
      Object.keys(urlParameters).forEach(field => {
        const param = urlParameters[field];
        switch (field) {
          case "product":
            this.highlightProduct(param);
            break;
          case "page":
            this.setPage(parseInt(param));
            break;
          case "sort":
            this.setState({ sort: param });
            break;
          case "searchString":
            this.setState({ isSearch: true, searchString: param, forceSearchString: true });
            break;
          default:
            break;
        }
      });
    });
  }

  getQuery = () => {
    let query = queryString.parse(window.location.search, { arrayFormat: 'comma' });
    query.stores = cleanForMissingStores(toArray(query.stores), this.state.stores);
    query.types = toArray(query.types);
    query.countries = toArray(query.countries);
    query.isGoodFor = toArray(query.isGoodFor);
    query.page = query.page || 1;
    query.sort = query.sort || sortOptions[0].value;
    return query;
  }

  componentDidMount() {

    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        firebase.firestore().collection("Users").doc(user.uid)
          .onSnapshot((doc) => {
            if (!doc.exists) {
              return null;
            }
            let userData = doc.data();
            userData.Id = user.uid;
            if (userData.products === undefined) {
              userData.products = [];
            }
            if (userData.filters === undefined) {
              userData.filters = [];
            }
            this.setState({
              user: userData
            }, () => this.createFilter());
          });
      } else {
        this.setState({ user: null });
      }
    });
    this.fetchInitialData();

  }

  fetchInitialData = async () => {
    await SpritjaktClient.FetchStores().then((stores) => {
      this.setState({
        stores: stores
      }, () => {
        let query = this.getQuery();
        if (query.page === 1) {
          delete query.page;
        }
        this.applyUrlParams(query);
        this.fetchProducts(query);
      })
    })
  }

  saveUserFilter(e) {
    if (this.state.user) {
      SpritjaktClient.SaveUserFilter(this.state.filter);
      this.notification.current.setNotification(e, "Lagret", "success");
      this.createFilter();
    } else {
      this.props.toggleLoginSection();
    }
  }

  createFilter() {
    let query = this.getQuery();
    let newFilter = {
      productTypes: query.types,
      stores: query.stores,
      countries: query.countries,
      isGoodFor: query.isGoodFor,
    }

    let filterExists = false;

    if ((newFilter.stores.length === 0
      && newFilter.productTypes.length === 0
      && newFilter.isGoodFor.length === 0
      && newFilter.countries.length === 0)
      || (this.state.user
        && this.state.user.filters.find(f =>
          arraysAreEqual(f.stores, newFilter.stores)
          && arraysAreEqual(f.productTypes, newFilter.productTypes)
          && arraysAreEqual(f.countries, newFilter.countries)
          && arraysAreEqual(f.isGoodFor, newFilter.isGoodFor)
        )
      )) {
      filterExists = true;
    }

    this.setState({ currentFilterExists: filterExists, filter: newFilter });
  }

  async fetchProducts(query = this.getQuery()) {

    let productTypes = this.state.productTypes;
    let productCountries = this.state.productCountries;
    let isGoodFor = this.state.isGoodFor;
    let stores = this.state.stores;
    this.setState({ loading: true });
    let result = await this.typeSenseClient.fetchProducts(query, this.state.pageSize);
    let products = result.hits.map(hit => hit.document);
    Object.keys(isGoodFor).forEach(gf => isGoodFor[gf].count = 0);
    Object.keys(productTypes).forEach(pt => productTypes[pt].count = 0);
    Object.keys(productCountries).forEach(c => productCountries[c].count = 0);
    stores.map(s => delete s.count);

    for (const f of result.facet_counts) {
      switch (f.field_name) {
        case "Country":
          for (const c of f?.counts) {
            if (productCountries[c.value] == undefined) {
              productCountries[c.value] = {};
            }
            productCountries[c.value].count = c.count;
          }
          break;
        case "Types":
          for (const c of f?.counts) {
            if (productTypes[c.value] == undefined) {
              productTypes[c.value] = {};
            }
            productTypes[c.value].count = c.count;
          }
          break;
        case "Stores":
          for (const c of f?.counts) {
            stores = stores.map(s => {
              if (c.value === s.storeId) {
                s.count = c.count;
              }
              return s;
            });
          }
          break;
        case "IsGoodForList":
          for (const c of f?.counts) {
            if (isGoodFor[c.value] == undefined) {
              isGoodFor[c.value] = {};
            }
            isGoodFor[c.value].count = c.count;
          }
          break;
        default:
          break;
      }
    }
    this.createFilter();
    this.setState({
      loading: false,
      productResult: products,
      productTypes: productTypes,
      productCountries: productCountries,
      stores: stores,
      found: result.found,
    });
  }

  searchProducts(searchString = null) {
    this.setUrlParams("searchString", searchString);
    if (this.state.forceSearchString) {
      this.fetchProducts();
      this.setState({ forceSearchString: false });
    } else {
      this.setPage(1);
    }
  }

  nextProduct = (change) => {
    let highlightedProductIndex = this.state.productResult.indexOf(this.state.highlightedProduct);
    let newHighlightedProduct = this.state.productResult[highlightedProductIndex + change] ?? null;
    if (newHighlightedProduct) {
      this.highlightProduct(newHighlightedProduct.Id);
    }
  }

  highlightProduct = async (productId) => {
    if (productId === null) {
      let productButton = document.querySelector('#p-' + this.state.highlightedProduct.Id + "> button");
      if (productButton) {
        if (!isInViewport(productButton))
          window.scroll({ top: productButton.getBoundingClientRect().top + document.documentElement.scrollTop - 150, left: 0, behavior: 'smooth' });
        productButton.focus({ preventScroll: true });
      }
      this.setState({ highlightedProduct: false });
      this.setUrlParams("product");
    } else {
      this.setUrlParams("product", productId);
      let product = this.state.productResult.find((p) => p.Id === productId);
      if (product === undefined) {
        product = await SpritjaktClient.FetchProductById(productId);
      }
      if( product.RawMaterials != undefined && !Array.isArray(product.RawMaterials))
      {
        product.RawMaterials = [product.RawMaterials];
      }
      this.setState({ highlightedProduct: product });
      firebase.analytics().logEvent("highlight_product");
    }
  };

  handleFilterClick = (propSlug, items) => {
    this.setUrlParams(propSlug, items);
    this.setPage(1);
  };

  applyUserFilter() {
    this.setPage(1);
  }

  handleSortChange = (event = null) => {
    this.changeSort(event?.target?.value);
    this.fetchProducts();
  }

  changeSort = (option = this.state.sort) => {
    if (option !== this.state.sort) {
      this.setUrlParams("sort", option);
      this.setState({
        sort: option
      });
    }
  };

  setPage = (page) => {
    this.setState({ page: page });
    this.setUrlParams("page", page);
    this.fetchProducts();
  }

  getFilterSection = () => {
    let {
      loading,
      stores,
      productTypes,
      productCountries,
      isGoodFor,
      filter,
      user,
      currentFilterExists,
      isSearch = false,
    } = this.state;
    let anchor = "bottom";
    return (
      <React.Fragment key={anchor}>
        {(!currentFilterExists && filter) &&
          <div className="filterSaver">
            <FontAwesomeIcon icon={faInfoCircle} size="sm" />
            <div>
              <span>Få varsel når produkter som matcher dette filteret kommer på tilbud. </span>
              {user && !user.notifications.onFilters &&
                <div>
                  <strong>Husk å tillate varsler på lagrede filtre i menyen under "Kontoinnstillinger"</strong>
                </div>
              }
            </div>
            <button className="greenBtn clickable" onClick={(e) => { this.saveUserFilter(e) }}>Lagre filter</button>
          </div>
        }
        <div className="nav">
          <SearchBar searchProducts={this.searchProducts.bind(this)} searchIsActive={isSearch} loading={loading} searchStringProp={this.state.searchString} forceSearchString={this.state.forceSearchString} />
          <Filter items={isGoodFor} selectedItems={filter.isGoodFor} propSlug={"isGoodFor"} label={"Passer til"} handleFilterChange={this.handleFilterClick.bind(this)} />
          <Filter items={productTypes} selectedItems={filter.productTypes} propSlug={"types"} label={"Type"} handleFilterChange={this.handleFilterClick.bind(this)} />
          <StoreSelector
            updateStore={this.handleFilterClick.bind(this)}
            selectedStores={filter.stores}
            stores={stores}
            notification={this.notification}
          />
          <Filter items={productCountries} selectedItems={filter.countries} propSlug={"countries"} label={"Land"} handleFilterChange={this.handleFilterClick.bind(this)} />

          <div className="sorting">
            <label htmlFor="sorting">Sortering
              <NativeSelect
                value={this.state.sort}
                onChange={this.handleSortChange}
                inputProps={{
                  name: 'sorting',
                  id: 'sorting',
                }}
              >
                {this.state.sortOptions.map(option => {
                  if (option !== undefined) {
                    return <option key={option?.value} value={option?.value}>{option?.label}</option>
                  }
                  return null;
                })}

              </NativeSelect>
            </label>
          </div>
        </div>
      </React.Fragment>
    )
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
      isGoodFor,
      filter,
      user,
      currentFilterExists,
      isSearch = false,
      found
    } = this.state;
    let anchor = "bottom";
    return (
      <div key="MainContent" className="MainContent" >
        <div className="main">
          <main>
            <div className="before-products">
                  {this.getFilterSection()}
            </div>
            <Pagination
              total={found}
              page={page}
              setPage={this.setPage.bind(this)}
              pageSize={pageSize}
              useScroll={false}
            />
            <ul className="product-list">
              {loading ?
                <div className="loader-wrapper" style={{ minHeight: "100vh" }}>
                  <img src={roundLogo} height="50" width="50" className="loader" />
                </div>
                :
                <ProductList
                  products={productResult}
                  page={page}
                  pageSize={pageSize}
                  notification={this.notification}
                  user={user}
                  highlightProduct={this.highlightProduct}
                  toggleLoginSection={this.props.toggleLoginSection}
                />
              }
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
              total={found}
              page={page}
              setPage={this.setPage.bind(this)}
              pageSize={pageSize}
              useScroll={true}
            />
            <ProductPopUp
              product={this.state.highlightedProduct}
              notification={this.notification}
              nextProduct={this.nextProduct.bind(this)}
              highlightProduct={this.highlightProduct.bind(this)}
            />
          </main>
        </div >
        <Notification ref={this.notification} />
      </div >
    );
  }
}

export default MainContent;
