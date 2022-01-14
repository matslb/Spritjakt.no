import React, { useEffect, useState } from "react";
import "./css/searchBar.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleNotch, faTimes } from "@fortawesome/free-solid-svg-icons";
import firebase from "firebase/app";
import "firebase/analytics";

const SearchBar = ({
  forceSearchString,
  searchStringProp = "",
  searchIsActive,
  loading,
  searchProducts
}) => {

  const [searchString, setSearchString] = useState("");
  const [productFetchTimeout, setProductFetchTimeout] = useState(null);

  const getHits = (event) => {
    clearTimeout(productFetchTimeout);
    let string = event.target.value;
    setSearchString(string);


    setProductFetchTimeout(setTimeout(() => {
      if (string.trim().length < 3) {
        setSearchString(string);
        return;
      }
      firebase.analytics().logEvent("search", { search_term: string });
      searchProducts(string);
    }, 500))
  }

  const handleKeyPress = async (event) => {
    if (event.key !== 'Enter') {
      return
    }
    searchProducts(searchString);
  }

  useEffect(() => {
    if (forceSearchString && searchString !== searchStringProp) {
      setSearchString(searchStringProp);
      if (searchStringProp !== "") {
        searchProducts(searchStringProp);
      }
    }
  }, [searchStringProp, forceSearchString])

  return (
    <div className="SearchBar">
      <label>
        <span>Søk</span>
        <input
          className="searchbox"
          type="text"
          placeholder="Søk på produktnavn eller varenummer"
          value={searchString}
          onChange={getHits}
          onKeyPress={handleKeyPress}
        />
        {(searchString.length >= 2 || searchIsActive) && (
          <button
            className="close"
            onClick={() => { setSearchString(""); searchProducts(null); }}
          >
            {loading ?
              <div className="product-list-loader">
                <FontAwesomeIcon icon={faCircleNotch} />
              </div>
              : <FontAwesomeIcon icon={faTimes} />
            }
          </button>
        )}
      </label>
    </div >
  );
}

export default SearchBar;
