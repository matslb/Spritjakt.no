import React from "react";
import ProductList from "./ProductList";
import SearchBar from "./SearchBar";
import queryString from "query-string";
import firebase from "firebase/app";
import "firebase/analytics";
import AccountSettings from "./AccountSettings";
import LoginPage from "./LoginPage";
import LoginForm from "./LoginForm";

class Homepage extends React.Component {
    constructor(props) {
        super(props);
        this.ProductList = React.createRef();
        this.LoginPage = React.createRef();
        this.Notification = React.createRef();
        this.AccountSettings = React.createRef();
    }

    componentDidMount() {
        this.registerSource();
        window.onpopstate = (e) => this.onbackPress(e);

    }

    onbackPress = (e) => {
        let query = queryString.parse(window.location.search, { arrayFormat: 'comma' });
        this.ProductList.current.setGraph(query.product || null);
        this.AccountSettings.current.toggleSection(query.settings === true);
    }

    registerSource = () => {
        let parsed = queryString.parse(window.location.search);
        if (parsed?.source) {
            firebase.analytics().logEvent(parsed.source + "_referral");
            window.history.replaceState('', '', '/');
        }
    }

    toggleLoginSection = () => {
        this.LoginPage.current.setFormType(LoginForm.formTypes.register);
    }
    applyUserFilter = () => {
        this.ProductList.current.filterProducts();
    }

    render() {

        return (
            <div className="homepage">
                <LoginPage ref={this.LoginPage} />
                <AccountSettings applyUserFilter={this.applyUserFilter.bind(this)} ref={this.AccountSettings} />
                <ProductList toggleLoginSection={this.toggleLoginSection.bind(this)} ref={this.ProductList} />
            </div>
        );
    }
}

export default Homepage;
