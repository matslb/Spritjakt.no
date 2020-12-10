import React from "react";
import "./css/miniProduct.css";
import SpritjaktClient from "../services/spritjaktClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";

class ProductComp extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      IsSelectedByUser: null
    };
    this.spritjaktClient = new SpritjaktClient();
  }

  toggleProdctWatch = () => {

  }

  render() {
    var { product } = this.props;
    var background = {
      backgroundImage:
        "url(https://bilder.vinmonopolet.no/cache/30x30/" +
        product.Id +
        "-1.jpg)",
    };
    let showDiff = product.SortingDiscount !== 100;
    let priceIsLower = product.LatestPrice < product.ComparingPrice;
    return (
      <li id={product.Id} className={"MiniProduct " + (priceIsLower ? "price_lowered" : "price_raised")}>
        <div onClick={() => this.props.setGraph(product.Id)} className="img" style={background}></div>
        <div onClick={() => this.props.setGraph(product.Id)} className="name">
          {product.Name}
        </div>
        <div>
          {showDiff &&
            <span className="percentage_change">
              {(priceIsLower ? "" : "+") + (product.SortingDiscount - 100).toFixed(1)}%
            </span>
          }
        </div>
        <div style={{ textAlign: "center" }}>
          <button className="iconBtn dark" onClick={(e) => {
            this.props.removeProduct();
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
