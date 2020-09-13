import React from "react";
import "./css/searchBar.css";
import ProductComp from "./ProductComp";
import SpritjaktClient from "../datahandlers/spritjaktClient";
import PriceGraph from "./PriceGraph";
import { CSSTransition } from "react-transition-group";
import { faCircleNotch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import firebase from "firebase/app";
import "firebase/analytics";

class SearchBar extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      searchString: "",
      lastFetch: Date.now(),
      loadedProducts: [],
      highlightedProduct: false,
    };
    this.SpritjaktClient = new SpritjaktClient();
    this.ProductFetchTimeout = null;
  }

  handleChange = (event) => {
    this.setState({ searchString: event.target.value });

    clearTimeout(this.ProductFetchTimeout);

    if (event.target.value.trim().length < 3) return;

    this.setState({ loading: true });

    this.ProductFetchTimeout = setTimeout(() => {
      this.SearchProducts(this.state.searchString);
    }, 500);
  };

  async SearchProducts(searchString) {
    let loadedProducts = await this.SpritjaktClient.SearchProducts(
      searchString.toLowerCase()
    );
    if (this.state.searchString !== searchString) return;
    this.setState({ loading: false, loadedProducts: loadedProducts });
    firebase.analytics().logEvent("product_search", { value: searchString });
  }

  displayProducts = () => {
    let list = [];
    this.state.loadedProducts.map((p) => {
      list.push(
        <ProductComp
          showDiff={false}
          key={p.Id}
          product={p}
          setGraph={this.setGraph.bind(this)}
        />
      );
    });
    if (list.length === 0) {
      list.push(
        <p
          style={{
            textAlign: " center",
            width: "100%",
            position: "absolute",
          }}
        >
          Fant ikke noe.
          <br />
          Men så er denne søkefunksjonen shit også da...
        </p>
      );
    }
    return list;
  };

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
        item_list_name: "Search Products list",
        item_list_id: 2,
      });
    }
  };
  render() {
    return (
      <div className="SearchBar">
        <p>Leter du etter noe spesielt?</p>
        <label>
          <span>Søk</span>
          <input
            className="searchbox"
            type="text"
            placeholder="Søk på produktnavn"
            value={this.state.searchString}
            onChange={this.handleChange}
          />
        </label>
        {this.state.searchString.length >= 3 && (
          <div className="wrapper">
            <button
              className="close"
              onClick={() => this.setState({ searchString: "" })}
            >
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <ul ref={this.productList} className="ProductList">
              {this.state.loading ? (
                <FontAwesomeIcon icon={faCircleNotch} size="5x" />
              ) : (
                  this.displayProducts()
                )}
            </ul>
          </div>
        )}
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
      </div>
    );
  }
}

export default SearchBar;
