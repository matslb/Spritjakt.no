import React from "react";
import "./css/miniProduct.css";
import SpritjaktClient from "../datahandlers/spritjaktClient";

class ProductComp extends React.Component {
  constructor(props) {
    super(props);
    this.productButton = React.createRef();
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

    return (
      <li id={product.Id} className="MiniProduct">
        <div onClick={() => this.props.setGraph(product.Id, this.productButton)} className="product_img" style={background}></div>
        <div onClick={() => this.props.setGraph(product.Id, this.productButton)}  className="product_details">
          <p className="name"><strong>{product.Name}</strong></p>
          <span className="type">{product.SubType}</span>
        </div>
      </li>
    );
  }
}

export default ProductComp;
