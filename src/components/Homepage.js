import React from "react";
import ProductList from "./ProductList";
import SearchBar from "./SearchBar";
import NewsLetterSignup from "./NewsLetterSignup";
import queryString from "query-string";
import firebase from "firebase/app";
import "firebase/analytics";

class Homepage extends React.Component {
    constructor() {
        super();
    }
    componentDidMount() {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.source === "sticker") {
            firebase.analytics().logEvent("sticker_ref");
            window.location.href = window.location.pathname;
        }
    }
    render() {

        return (
            <div className="homepage">
                <NewsLetterSignup />
                <SearchBar />
                <ProductList />
            </div>
        );
    }
}

export default Homepage;
