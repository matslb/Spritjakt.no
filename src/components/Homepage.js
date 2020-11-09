import React from "react";
import ProductList from "./ProductList";
import SearchBar from "./SearchBar";
import queryString from "query-string";
import firebase from "firebase/app";
import "firebase/analytics";
import NotificationSettings from "./NotificationSettings";

class Homepage extends React.Component {

    componentDidMount() {
        this.registerSource();
    }

    registerSource = () => {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.source) {
            firebase.analytics().logEvent(parsed.source + "_referral");
            window.history.pushState('', '', '/');
        }
    }

    render() {

        return (
            <div className="homepage">
                <NotificationSettings />
                <SearchBar />
                <ProductList />
            </div>
        );
    }
}

export default Homepage;
