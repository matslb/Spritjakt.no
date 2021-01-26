import React from "react";
import "./css/searchBar.css";
import ProductComp from "./ProductComp";
import SpritjaktClient from "../services/spritjaktClient";
import ProductPopUp from "./ProductPopUp";
import { faCircleNotch, faTimes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import firebase from "firebase/app";
import "firebase/analytics";
import Notification from "./Notification";

class SearchBar extends React.Component {
  constructor() {
    super();
    this.state = {
      loading: false,
      searchString: "",
      lastFetch: Date.now(),
      productResult: [],
      highlightedProduct: false,
    };
    this.SpritjaktClient = new SpritjaktClient();
    this.ProductFetchTimeout = null;
    this.Notification = React.createRef();
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
    let productResult = await this.SpritjaktClient.SearchProducts(searchString.toLowerCase());
    if (this.state.searchString !== searchString) return;
    productResult.map(p => {
      p.Stock.Stores.map(s => {
        if (!s.pointOfService) {
          s.pointOfService = {
            name: s.name,
            displayName: s.displayName
          }
        }
        return s;
      })
      return p;
    })
    this.setState({ loading: false, productResult: productResult });
    firebase.analytics().logEvent("product_search", { value: searchString });
  }

  displayProducts = () => {
    let list = [];
    this.state.productResult.forEach((p) => {
      list.push(
        <ProductComp
          key={p.Id}
          product={p}
          notification={this.Notification}
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

  nextProduct = (change) => {
    let highlightedProductIndex = this.state.productResult.indexOf(this.state.highlightedProduct);
    let newHighlightedProduct = this.state.productResult[highlightedProductIndex + change] ?? null;
    this.setGraph(null, null);
    if (newHighlightedProduct) {
      this.setGraph(newHighlightedProduct.Id);
    }
  }
  setGraph = (productId) => {
    if (productId === null || productId === this.state.highlightedProduct.Id) {
      this.setState({ highlightedProduct: false, graphIsVisible: false });
    } else {
      let product = this.state.productResult.find((p) => p.Id === productId);
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
        <ProductPopUp product={this.state.highlightedProduct} notification={this.Notification} graphIsVisible={this.state.graphIsVisible} nextProduct={this.nextProduct.bind(this)} setGraph={this.setGraph.bind(this)} />
        <Notification ref={this.Notification} />
      </div>
    );
  }
}

export default SearchBar;
