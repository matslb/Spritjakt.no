import { faArrowCircleLeft, faArrowCircleRight, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import { CSSTransition } from "react-transition-group";
import PriceGraph from "./PriceGraph";

class PopupProduct extends React.Component {
  
  render() {
    return (
        <div className="PopupProduct" style={{position:"absolute", zIndex:"999999"}} >
        <CSSTransition
                in={this.props.graphIsVisible}
                timeout={100}
                className="toggle"
                onExited={() => this.props.setGraph(null, null)}
                >
                <div>
                    {this.props.product && (
                    <div>
                        <div className="backdrop" onClick={() => this.props.setGraph(null, null)} >
                        </div>
                    <div className="priceGraphWrapper">
                        <PriceGraph p={this.props.product} />
                        <nav className="productNavigation">
                            <button aria-label="Forrige produkt" onClick={() => this.props.nextProduct(-1)} className="iconBtn productNav prev">
                                <FontAwesomeIcon  size="lg" icon={faArrowCircleLeft} />
                            </button>
                            <button aria-label="Tilbake" name="closeGraph"  onClick={() => this.props.setGraph(null, null)} className="iconBtn productNav close">
                                <FontAwesomeIcon size="lg" icon={faTimesCircle} />
                            </button>
                            <button aria-label="Neste produkt" onClick={() => this.props.nextProduct(1)} className="iconBtn productNav next">
                                <FontAwesomeIcon  size="lg" icon={faArrowCircleRight} />
                            </button>
                        </nav>
                    </div>
                    </div>
                    )}
                </div>
                </CSSTransition>
      </div>
    );
  }
}

export default PopupProduct;

