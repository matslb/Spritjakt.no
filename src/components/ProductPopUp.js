import { faArrowCircleLeft, faArrowCircleRight, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React from "react";
import HighlightedProduct from "./HighlightedProduct";
import "./css/popupProduct.css";

const ProductPopUp = ({
    notification,
    product,
    nextProduct,
    highlightProduct
}) => {
    return (
        <div className="PopupProduct" style={{ position: "absolute", zIndex: "99" }} >
            {product && (
                <div>
                    <div className="backdrop" onClick={() => highlightProduct(null, null)} >
                    </div>
                    <div className="PopupProductWrapper">
                        <HighlightedProduct highlightProduct={highlightProduct} product={product} notification={notification} />
                        <nav className="productNavigation">
                            {nextProduct &&
                                <button aria-label="Forrige produkt" onClick={() => nextProduct(-1)} className="iconBtn productNav prev">
                                    <FontAwesomeIcon size="lg" icon={faArrowCircleLeft} />
                                </button>
                            }
                            <button aria-label="Lukk fremhevet produktvisning" name="closeGraph" onClick={() => highlightProduct(null, null)} className="iconBtn productNav close">
                                <FontAwesomeIcon size="lg" icon={faTimesCircle} />
                            </button>
                            {nextProduct &&
                                <button aria-label="Neste produkt" onClick={() => nextProduct(1)} className="iconBtn productNav next">
                                    <FontAwesomeIcon size="lg" icon={faArrowCircleRight} />
                                </button>
                            }
                        </nav>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ProductPopUp;
