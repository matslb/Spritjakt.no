import React from "react";
import "./css/searchBar.css";
import "firebase/analytics";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleNotch, faThumbsDown, faTimes } from "@fortawesome/free-solid-svg-icons";
import firebase from "firebase/app";
import "firebase/analytics";

class SearchBar extends React.Component {
  constructor() {
    super();
    this.state = {
      searchString: "",
      lastFetch: Date.now(),
    };
    this.ProductFetchTimeout = null;
  }

  handleChange = (event) => {
    this.setState({ searchString: event.target.value });

    clearTimeout(this.ProductFetchTimeout);

    if (event.target.value.trim().length < 3) return;

    this.ProductFetchTimeout = setTimeout(() => {
      firebase.analytics().logEvent("search", { search_term: this.state.searchString });
      this.props.searchProducts(this.state.searchString);
    }, 500);
  };

  render() {
    return (
      <div className="SearchBar">
        <label>
          <span>Søk</span>
          <input
            className="searchbox"
            type="text"
            placeholder="Søk på produktnavn"
            value={this.state.searchString}
            onChange={this.handleChange}
          />
          {(this.state.searchString.length >= 3 || this.props.searchIsActive) && (
            <button
              className="close"
              onClick={() => { this.setState({ searchString: "" }); this.props.searchProducts(); }}
            >
              {this.props.loading ?
                <div className="product-list-loader">
                  <FontAwesomeIcon icon={faCircleNotch} />
                </div>
                : <FontAwesomeIcon icon={faTimes} />
              }
            </button>
          )}
        </label>
        <div className="wrapper">
        </div>
      </div>
    );
  }
}

export default SearchBar;
