import * as React from 'react';
import Pagination from "./Pagination";
import "./css/mainContent.css";
import { faInfoCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ProductPopUp from "./ProductPopUp";
import firebase from "firebase/compat/app";
import StoreSelector from "./StoreSelector";
import {  Box, Button, ButtonGroup, Card, CardContent, Fab, FormControlLabel, NativeSelect, SwipeableDrawer, Switch, ToggleButton, ToggleButtonGroup, grid2Classes } from '@mui/material';
import { FilterListOutlined } from '@mui/icons-material';
import queryString from "query-string";
import Notification from "./Notification";
import Filter from "./Filter";
import SearchBar from "./SearchBar";
import ProductList from "./ProductList";
import { arraysAreEqual, cleanForMissingStores, isInViewport, toArray, volumeOptions } from "../utils/utils.js";
import TypeSenseClient from "../services/typeSenseClient";
import roundLogo from "../assets/round-logo.svg";
import SpritjaktClient from "../services/spritjaktClient";

import { sortOptions } from "../utils/utils.js";
import { isMobile } from 'react-device-detect';
import PriceFilter from './PriceFilter';
import FilterV2 from './FilterV2';
import PaginationSection from './Pagination';

class MainContent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      stores: [],
      loading: true,
      sort: "LastUpdated_desc",
      productTypes: [],
      isGoodFor: [],
      productCountries: [],
      highlightedProduct: null,
      productResult: [],
      page: 1,
      pageSize: 20,
      user: null,
      isSearch: false,
      currentFilterExists: true,
      searchString: "",
      forceSearchString: false,
      drawerState: false,
     filter: {
        stores: [],
        countries: [],
        isGoodFor: [],
        volume: [],
        min: null,
        max: null,
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
          case "view":
            this.setState({ viewAll: param+"" });
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
    query.volume = toArray(query.volume);
    query.page = query.page || 1;
    query.sort = query.sort || sortOptions[0].value;
    query.min = query.min || null;
    query.max = query.max || null;
    if(query.view === 'true'){
      query.view = true;
    }
    else if(query.view === 'false'){
      query.view = false;
    }
    else {
      query.view = (query.countries.length > 0 
          || query.volume.length > 0 
          || query.types.length > 0 
          || query.stores.length > 0 
          || query.isGoodFor.length > 0 ) ? true : false;
      }
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
      min: query.min,
      max: query.max,
      volume: query.volume,
      view: query.view
    }
    let filterExists = false;

    if ((newFilter.stores.length === 0
      && newFilter.productTypes.length === 0
      && newFilter.isGoodFor.length === 0
      && newFilter.countries.length === 0
      && newFilter.min == undefined 
      && newFilter.max  == undefined )
      || (this.state.user
        && this.state.user.filters.find(f =>
          arraysAreEqual(f.stores, newFilter.stores)
          && arraysAreEqual(f.productTypes, newFilter.productTypes)
          && arraysAreEqual(f.countries, newFilter.countries)
          && arraysAreEqual(f.isGoodFor, newFilter.isGoodFor)
          && f.min == newFilter.min && f.max == newFilter.max
        )
      )) {
      filterExists = true;
    }
    this.setState({ 
      currentFilterExists: filterExists,
      filter: newFilter,
      viewAll: newFilter.view  
    });
  }

  setFacetCount = (selected, facetcounts) => {
    selected.map(s => s.count = 0);
    for (const f of facetcounts) {
      var index = selected.findIndex(x => x.value === f.value)
      if(index === -1)
          selected.push({
              value: f.value,
              label: f.value
          });
        else
        selected[index].count = f.count;
    }
    return selected;
  }
  
  async fetchProducts(query = this.getQuery()) {

    let stores = this.state.stores;
    this.setState({ loading: true });
    let result = await this.typeSenseClient.fetchProducts(query, this.state.pageSize);
    let products = result.hits.map(hit => hit.document);

    stores.map(s => delete s.count);
    
    for (const f of result.facet_counts) {
      switch (f.field_name) {
        case "Country":
       var productCountries = this.setFacetCount(this.state.productCountries, f.counts);
          break;
        case "Types":
       var productTypes = this.setFacetCount(this.state.productTypes, f.counts);
          break;
        case "Stores":
          for (const c of f?.counts) {
            stores = stores.map(s => {
              if (c.value === s.storeId) {
                s.count = c.count;
                s.value = s.storeId;
                s.label = `${s.storeName} (${s.count})`
              }
              return s;
            });
          }
          break;
        case "IsGoodForList":
          var isGoodFor = this.setFacetCount(this.state.isGoodFor, f.counts);
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
      isGoodFor: isGoodFor,
      found: result.found,
    });
  }

  searchProducts(searchString = null) {
    this.setUrlParams("searchString", searchString);
    this.setUrlParams("view", true);
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

  SetPriceFilter = (min, max) => {
    this.setUrlParams("min", min);
    this.setUrlParams("max", max);
    this.setPage(1);
  }

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
      viewAll
    } = this.state;
    let anchor = "bottom";
    return (
      <React.Fragment key={anchor}>
        {isMobile &&
           <Box sx={{
            display:'flex',
            width: "100%",
            justifyContent: 'center',
          }}>
            <ToggleButtonGroup
                  value={viewAll+""}
                  exclusive
                  size='small'
                  onChange={this.toggleDiscountView}
                  aria-label="Produkter som vises"
                  >
                  <ToggleButton value="false">Vis tilbud</ToggleButton>
                  <ToggleButton value="true">Vis alle</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        }
        <div className="nav">
          <SearchBar searchProducts={this.searchProducts.bind(this)} searchIsActive={isSearch} loading={loading} searchStringProp={this.state.searchString} forceSearchString={this.state.forceSearchString} />
          <FilterV2 items={isGoodFor} selectedItems={filter.isGoodFor} propSlug={"isGoodFor"} label={"Passer til"} handleFilterChange={this.handleFilterClick.bind(this)} />
          <FilterV2 items={productTypes} selectedItems={filter.productTypes} propSlug={"types"} label={"Type"} handleFilterChange={this.handleFilterClick.bind(this)} />
          <StoreSelector
            updateStore={this.handleFilterClick.bind(this)}
            selectedStores={filter.stores}
            stores={stores}
            notification={this.notification}
          />

          <FilterV2 items={productCountries} selectedItems={filter.countries} propSlug={"countries"} label={"Land"} handleFilterChange={this.handleFilterClick.bind(this)} />
          <PriceFilter SetPriceFilter={this.SetPriceFilter} max={filter.max} min={filter.min} />
          <FilterV2 items={volumeOptions} selectedItems={filter.volume} propSlug={"volume"} label={"Volum"} handleFilterChange={this.handleFilterClick.bind(this)} />
          {isMobile &&
             <Box sx={{
              display:'flex',
              width: "100%",
              justifyContent: 'center',
            }}>
            <ButtonGroup variant="outlined" aria-label="outlined primary button group">
                      {user && (!currentFilterExists && filter) ? 
                        <Button size="small"  onClick={(e) => { this.saveUserFilter(e) }}>Lagre filter</Button>
                        :
                        <Button size="small"  disabled>Lagre filter</Button>
                      }
            </ButtonGroup>
            </Box>
          }
        </div>
      </React.Fragment>
    )
  }

  toggleDrawer = (x) => {
    this.setState({drawerState: x });
  }

  toggleDiscountView = (x) => {
    this.setState({viewAll: x.target.value === 'true'});
    this.setUrlParams("view", x.target.value);
    this.setPage(1);
  }

  render() {
    let {
      loading,
      pageSize,
      page,
      productResult,
      user,
      found,
      drawerState,
      viewAll,
      filter,
      currentFilterExists
    } = this.state;
    return (
      <div key="MainContent" className="MainContent" >
        <div className="main">
          <main>
            { !isMobile &&
            <div className="before-products">
                  {this.getFilterSection()}
            </div>
            }
            {isMobile &&
            <React.Fragment key={"drawer"}>
              <Fab onClick={() => this.toggleDrawer(true)} className='fixed bottom left' size="medium"  aria-label="add">
                <FilterListOutlined/>
              </Fab>
              <SwipeableDrawer
                className="filter-drawer"
                open={drawerState}
                anchor= "bottom"
                disableSwipeToOpen={true}
                swipeAreaWidth={20}
                ModalProps={{
                  keepMounted: true,
                }}
                onClose={() => this.toggleDrawer(false)}
                onOpen={() => this.toggleDrawer(true)}
                >
                <Card >
                  <div className="handle">
                    <span className="puller"></span>
                  </div>
                  <CardContent>
                      {this.getFilterSection()}
                  </CardContent>
                </Card>
              </SwipeableDrawer>                  
            </React.Fragment>
            }
              {!isMobile &&  
            <Box sx={{
              display:'flex',
              width: "100%",
              justifyContent: isMobile ? 'center' :'space-between',
              marginTop: "1rem"              
            }}>
              <div className="filterSaver">
                  <ButtonGroup variant="outlined" aria-label="outlined primary button group">
                    {user && (!currentFilterExists && filter) ? 
                      <Button size="small"  onClick={(e) => { this.saveUserFilter(e) }}>Lagre filter</Button>
                      :
                      <Button size="small"  disabled>Lagre filter</Button>
                    }
                  </ButtonGroup>
                </div>
                <ToggleButtonGroup
                  value={viewAll+""}
                  exclusive
                  size='small'
                  onChange={this.toggleDiscountView}
                  aria-label="Produkter som vises"
                  >
                  <ToggleButton value="false">Tilbud</ToggleButton>
                  <ToggleButton value="true">Alle</ToggleButton>
                </ToggleButtonGroup>
                </Box>
              }
            <PaginationSection
              total={found}
              handleSortChange={this.handleSortChange}
              page={page}
              setPage={this.setPage.bind(this)}
              pageSize={pageSize}
              useScroll={false}
              cssAnchor={"top-pagination"}
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
            <PaginationSection
              total={found}
              page={page}
              setPage={this.setPage.bind(this)}
              pageSize={pageSize}
              useScroll={true}
              cssAnchor={"bottom-pagination"}
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
