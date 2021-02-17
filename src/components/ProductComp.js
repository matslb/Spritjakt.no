import React from "react";
import "./css/productComp.css";
import { faBoxes, faHeart } from "@fortawesome/free-solid-svg-icons";
import { faHeart as faHeartRegular } from "@fortawesome/free-regular-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import dateFormater from "../dateFormater";
import SpritjaktClient from "../services/spritjaktClient";
import firebase from "firebase/app";

class ProductComp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      IsSelectedByUser: null
    };
    this.spritjaktClient = new SpritjaktClient();
  }

  async componentDidMount() {
    firebase.auth().onAuthStateChanged((user) => {
      if (user) {
        firebase.firestore().collection("Users").doc(user.uid)
          .onSnapshot(async (doc) => {
            let userData = doc.data();
            if (userData) {
              let IsSelectedByUser = userData.products !== undefined ? userData.products.includes(this.props.product.Id) : false;
              this.setState({ userData: userData, IsSelectedByUser: IsSelectedByUser });
            }
          });
      } else {
        this.setState({ IsSelectedByUser: null });
      }
    });
  }

  toggleProdctWatch = (e) => {

    if (this.state.IsSelectedByUser) {
      this.spritjaktClient.RemoveProductFromUser(this.props.product.Id)
      this.props.notification.current.setNotification(e, "Fjernet", "success");
    } else {
      this.spritjaktClient.AddProductToUser(this.props.product.Id)
      this.props.notification.current.setNotification(e, "Lagt til", "success");
    }
    this.setState({ IsSelectedByUser: !this.state.IsSelectedByUser });
  }

  render() {
    let { product, selectedStores = [] } = this.props;
    let showDiff = product.Discount !== 100;
    let priceIsLower = product.LatestPrice < product.ComparingPrice;
    let lastChangedDate = dateFormater.format(product.LastUpdated);
    let stock = 0;
    let isSoldOut = false;

    if (product.Stock.Stores.length > 0 && !selectedStores.includes("0")) {
      let stores = product.Stock.Stores.filter((s) => selectedStores.includes(s.pointOfService.name));
      stores.forEach(store => {
        stock += store.stockInfo.stockLevel;
      });

    } else {
      for (const i in product.Stock.Stores) {
        stock += product.Stock.Stores[i].stockInfo.stockLevel;
      }
    }
    if (stock === 0) {
      stock = product.ProductStatusSaleName ? product.ProductStatusSaleName.replace("Midlertidig", "") : "Nettlager";
      if (product.ProductStatusSaleName) {
        isSoldOut = true;
      }
    }

    return (
      <li
        id={product.Id}
        className={
          "ProductComp " + (priceIsLower ? "price_lowered" : "price_raised")
        }>
        <button
          style={{
            padding: 0,
            opacity: 0,
          }}
          onClick={() => this.props.setGraph(product.Id)}
        >
          {product.Name}
        </button>
        <div onClick={() => this.props.setGraph(product.Id)} className={"product_img " + (isSoldOut ? " soldOut" : "")} /*style={background}*/>
          <img loading={'lazy'} alt={product.Name} height="200px" width="auto" src={"https://bilder.vinmonopolet.no/cache/80x80/" + product.Id + "-1.jpg"} />
        </div>
        {showDiff &&
          <span className="percentage_change">
            {(priceIsLower ? "" : "+") + (product.Discount - 100).toFixed(1)}%
          </span>
        }
        <span className="productWatchBtns">
          <span className="changeDate">
            {lastChangedDate}
          </span>
          {this.state.IsSelectedByUser &&
            <button aria-label="Fjern fra favoritter" className="iconBtn watched" onClick={this.toggleProdctWatch}><FontAwesomeIcon icon={faHeart} size="lg" /></button>
          }
          {this.state.IsSelectedByUser === false &&
            <button aria-label="Legg til i favoritter" className="watch dark iconBtn" onClick={this.toggleProdctWatch}><FontAwesomeIcon icon={faHeartRegular} size="lg" /></button>
          }
        </span>
        <div onClick={() => this.props.setGraph(product.Id)} className="product_details">
          <span className="type">{product.SubType}</span>
          {isSoldOut &&
            <span className={"soldOutSticker"}>
              {stock}
            </span>
          }
          <span className={"stock"} title="Lagerstatus">
            {stock}
            <FontAwesomeIcon icon={faBoxes} />
          </span>
          <h2 className="name">{product.Name}</h2>
          <span className="price">Kr {product.LatestPrice}</span>
          {product.ComparingPrice && (
            <span className="old_price secondary">Kr {product.ComparingPrice}</span>
          )}
          <span className="volume secondary">
            {(product.Volume * 100).toFixed(1)} cl
          </span>
          <span className="alcohol secondary">Alk. {product.Alcohol}%</span>
        </div>
      </li >
    );
  }
}

export default ProductComp;
