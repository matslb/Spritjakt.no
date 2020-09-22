import React from "react";
import "./css/productComp.css";
import { faBoxes } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import dateFormater from "../dateFormater";

class ProductComp extends React.Component {
  constructor(props) {
    super(props);
    this.productButton = React.createRef();
  }
  render() {
    var { product, selectedStore = "0" } = this.props;
    var background = {
      backgroundImage:
        "url(https://bilder.vinmonopolet.no/cache/100x100/" +
        product.Id +
        "-1.jpg)",
    };
    var showDiff = product.SortingDiscount !== 100 ?? false;
    var priceIsLower = product.LatestPrice < product.ComparingPrice;
    var lastChangedDate = dateFormater.format(product.LastUpdated);
    var stock = 0;
    if (product.Stock.Stores.length > 0 && selectedStore !== "0") {
      var store = product.Stock.Stores.find((s) => s.name === selectedStore);
      stock = store.stockInfo.stockLevel;
    } else if (product.Stock.Stores.length > 0) {
      for (const i in product.Stock.Stores) {
        stock += product.Stock.Stores[i].stockInfo.stockLevel;
      }
    }
    if (stock === 0) {
      stock = product.ProductStatusSaleName ? product.ProductStatusSaleName : "Kan bestilles";
    }

    return (
      <li
        id={product.Id}
        className={
          "ProductComp " + (priceIsLower ? "price_lowered" : "price_raised")
        }
        onClick={() => this.props.setGraph(product.Id, this.productButton)}
      >
        <button
          style={{
            padding: 0,
            opacity: 0,
          }}
          ref={this.productButton}
          onClick={() => this.props.setGraph(product.Id, this.productButton)}
        >
          {product.Name}
        </button>
        <div className="product_img" style={background}></div>
        {showDiff &&
          <span className="percentage_change">
            {(priceIsLower ? "" : "+") + (product.SortingDiscount - 100).toFixed(1)}%
          </span>
        }
        <span className="change_time">
          Endret<br /> {lastChangedDate.toISOString().slice(0, 10)}
        </span>
        <div className="product_details">
          <h2 className="name">{product.Name}</h2>
          <span className="type">{product.SubType}</span>
          <span className="stock" title="Lagerstatus">
            {stock + " "}
            <FontAwesomeIcon icon={faBoxes} />
          </span>
          <span className="volume">
            {(product.Volume * 100).toFixed(1)}
            cl
          </span>
          <span className="alcohol">Alk. {product.Alcohol}%</span>
          <span className="price">Kr. {product.LatestPrice}</span>
          {showDiff && (
            <span className="old_price">Kr. {product.ComparingPrice}</span>
          )}
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
      </li>
    );
  }
}

export default ProductComp;
