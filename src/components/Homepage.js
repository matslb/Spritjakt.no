import React from "react";
import ProductList from "./ProductList";
import SearchBar from "./SearchBar";
import queryString from "query-string";
import firebase from "firebase/app";
import "firebase/analytics";
import NotificationSettings from "./NotificationSettings";

class Homepage extends React.Component {
    constructor(props){
        super(props);
        this.ProductList = React.createRef();
    }

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

    applyUserFilter = () => {
        this.ProductList.current.updateUrlParams();
    }

    render() {

        return (
            <div className="homepage">
                <NotificationSettings applyUserFilter={this.applyUserFilter.bind(this)} />
                <SearchBar />
                <ProductList ref={this.ProductList}   />
            </div>
        );
    }
}

export default Homepage;
