import React from "react";
import "./css/miniProduct.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { getImageUrl } from "../utils/utils.js";

class ProductComp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      IsSelectedByUser: null
    };
  }

  render() {
    var { product } = this.props;
    var background = {
      backgroundImage: "url(" + getImageUrl(product.Id, 300) + ")"
    };
    let showDiff = product.PriceChange && product.PriceChange !== 100;
    let priceIsLower = product.LatestPrice < product.PriceHistory[product.PriceHistorySorted[1]];
    return (
      <li id={product.Id} className={"MiniProduct " + (priceIsLower ? "price_lowered" : "price_raised")}>
        {showDiff &&
          <span className="percentage_change">
            {(priceIsLower ? "" : "+") + (product.PriceChange - 100).toFixed(1)}%
          </span>
        }
        <button aria-label="Se produktdetaljer" onClick={() => this.props.highlightProduct(product.Id)} className="img" style={background}></button>
        <div onClick={() => this.props.highlightProduct(product.Id)} className="name">
          {product.Name}
        </div>
        <div style={{ textAlign: "center" }}>
          <button aria-label="Fjern fra favoritter" className="iconBtn dark" onClick={(e) => {
            this.props.removeProduct(product.Id);
            this.props.notification.current.setNotification(e, "Fjernet", "success");
          }} >
            <FontAwesomeIcon icon={faTrash} />
          </button>
        </div>
      </li>
    );
  }
}

export default ProductComp;
