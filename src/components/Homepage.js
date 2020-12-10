import React from "react";
import ProductList from "./ProductList";
import SearchBar from "./SearchBar";
import queryString from "query-string";
import firebase from "firebase/app";
import "firebase/analytics";
import NotificationSettings from "./NotificationSettings";
import LoginPage from "./LoginPage";

class Homepage extends React.Component {
    constructor(props) {
        super(props);
        this.ProductList = React.createRef();
        this.LoginPage = React.createRef();
        this.Notification = React.createRef();
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

    toggleLoginSection = () => {
        this.LoginPage.current.toggleLoginSection();
    }
    applyUserFilter = () => {
        this.ProductList.current.updateUrlParams();
    }

    render() {

        return (
            <div className="homepage">
                <SearchBar />
                <LoginPage ref={this.LoginPage} />
                <NotificationSettings applyUserFilter={this.applyUserFilter.bind(this)} />
                <ProductList toggleLoginSection={this.toggleLoginSection.bind(this)} ref={this.ProductList} />
            </div>
        );
    }
}

export default Homepage;
