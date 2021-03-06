import React from "react";
import "./css/highlightedProduct.css";
import SortArray from "sort-array";
import { faExternalLinkAlt, faHeart } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import SpritjaktClient from "../services/spritjaktClient";
import firebase from "firebase/app";

class HighlightedProduct extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      user: false,
      IsSelectedByUser: false
    };
    this.spritjaktClient = new SpritjaktClient();
    this.productButton = React.createRef();
  }

  async componentDidMount() {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        this.setState({ user: user });
      } else {
        this.setState({ IsSelectedByUser: null });
      }
    });
  }

  componentDidUpdate() {
    if (!this.state.user)
      return;

    firebase.firestore().collection("Users").doc(this.state.user.uid)
      .onSnapshot(async (doc) => {
        let userData = doc.data();
        if (userData) {
          let IsSelectedByUser = userData.products !== undefined ? userData.products.includes(this.props.product.Id) : false;
          this.setState({ userData: userData, IsSelectedByUser: IsSelectedByUser });
        }
      });
  }

  toggleProdctWatch = (e) => {

    if (this.state.IsSelectedByUser) {
      this.spritjaktClient.RemoveProductFromUser(this.props.product.Id);
      this.props.notification.current.setNotification(e, "Fjernet", "success");

    } else {
      this.spritjaktClient.AddProductToUser(this.props.product.Id)
      this.props.notification.current.setNotification(e, "Lagt til", "success");
    }
    this.setState({ IsSelectedByUser: !this.state.IsSelectedByUser });
  }

  renderStoreStock = () => {
    let product = this.props.product;
    let list = [];
    let stores = product.Stock.Stores;
    SortArray(stores, {
      by: "displayName",
      computed: {
        displayName: store => store.pointOfService.displayName
      }
    });
    stores.map((store) =>
      list.push(
        <li key={store.pointOfService.name}>
          <span>{store.pointOfService.displayName}:</span>
          {store.stockInfo.stockLevel} stk
        </li>
      )
    );
    list.push(
      <li key={"0"}>
        <span>
          Nettbutikk:
            </span>
        {product.ProductStatusSaleName ?
          product.ProductStatusSaleName : "Kan bestilles"
        }
      </li>
    );
    return list;
  };

  render() {
    var { product } = this.props;
    var background = {
      backgroundImage: "url(https://bilder.vinmonopolet.no/cache/100x100/" + product.Id + "-1.jpg)",
    };
    var priceIsLower = product.LatestPrice < product.ComparingPrice;
    var showDiff = product.Discount !== 100;

    return (
      <div
        id={product.Id}
        className={
          "HighlightedProduct " +
          (priceIsLower ? "price_lowered" : "price_raised")
        }
      >
        <span className="productWatchBtns">
          {this.state.IsSelectedByUser &&
            <button aria-label="Fjern fra favoritter" className="iconBtn watched" onClick={this.toggleProdctWatch}><FontAwesomeIcon icon={faHeart} size="lg" /></button>
          }
          {this.state.IsSelectedByUser === false &&
            <button aria-label="Legg til i favoritter" className="watch iconBtn dark" onClick={this.toggleProdctWatch}><FontAwesomeIcon icon={faHeartRegular} size="lg" /></button>
          }
        </span>
        <div className="product_img" style={background}></div>
        {showDiff &&
          <span className="percentage_change">
            {(priceIsLower ? "" : "+") + (product.Discount - 100).toFixed(1)}%
          </span>
        }
        <div className="product_details">
          <h2 className="name">{product.Name}</h2>
          <span className="price">Kr {product.LatestPrice}</span>
          <span className="old_price">{product.ComparingPrice && "Kr " + product.ComparingPrice}</span>
          <span className="details">
            {product.SubType}, {product.Country}
            <br />
            {(product.Volume * 100).toFixed(1)}
            cl, Alk. {product.Alcohol}%
          </span>
          <span className="liter_price">Kr {product.Literprice.toFixed(0)} per liter</span>
          <span className="liter_price_alchohol">Kr {product.LiterPriceAlcohol.toFixed(0)} per liter alkohol</span>
          {product.Description && (
            <span className="description">
              <p className="colour">
                <span>Farge</span>
                {product.Description.characteristics.colour}
              </p>
              <p className="odour">
                <span>Lukt</span>
                {product.Description.characteristics.odour}
              </p>
              <p className="taste">
                <span>Smak</span>
                {product.Description.characteristics.taste}
              </p>
            </span>
          )}

        </div>
        <a
          rel="noopener noreferrer"
          ref={(link) => {
            this.vmpLink = link;
          }}
          className="clickable bigGoldBtn"
          target="_blank"
          style={{ width: "100%" }}
          href={"https://www.vinmonopolet.no/p/" + product.Id}
        >
          Se hos vinmonopolet
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
        <div className="product_stock">
          <h4 className="title" >Lagerstatus</h4>
          <ul>{this.renderStoreStock()}</ul>
        </div>
      </div >
    );
  }
}

export default HighlightedProduct;
