import React, { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./css/hallOfFame.css";
import { faChartLine, faCircleNotch, faCrown, faGlassCheers, faMoneyBillWave } from "@fortawesome/free-solid-svg-icons";
import Product from "./Product";
import ProductPopUp from "./ProductPopUp";
import Notification from "./Notification";
import roundLogo from "../assets/round-logo.svg";
import SpritjaktClient from "../services/spritjaktClient";
import TypeSenseClient from "../services/typeSenseClient";

const HallOfFame = () => {

    const typeSenseClient = new TypeSenseClient();
    const [hallOfFameProducts, setHallOfFameProducts] = useState(null);
    const [highlightedProduct, setHighlightedProduct] = useState(null);
    const notification = React.createRef();

    useEffect(() => {
        fetchProducts();
    }, [null]);

    const fetchProducts = async () => {
        let hallOfFameProducts = await typeSenseClient.fetchHallOfFameProducts();
        hallOfFameProducts.mostVolatile = await SpritjaktClient.FetchMostVolatileProduct();
        setHallOfFameProducts(hallOfFameProducts);
    }

    const highlightProduct = (productId) => {

        if (productId === null || productId === highlightedProduct?.Id) {
            setHighlightedProduct(null);
        } else {
            let productKey = Object.keys(hallOfFameProducts).find((key) => hallOfFameProducts[key].Id === productId);
            setHighlightedProduct(hallOfFameProducts[productKey]);
        }
    };

    return (
        <div className="hall-of-fame">
            {!hallOfFameProducts ?
                <div className="loader-wrapper">
                    <img src={roundLogo} height="50" width="50" className="loader" />
                </div>
                :
                <ul className="product-list hall-of-fame">
                    <li className="famed-product cheapestByAlcohol">
                        <FontAwesomeIcon icon={faGlassCheers} size="3x" />
                        <h3 className="gold" >Billigste fyll</h3>
                        {hallOfFameProducts?.cheapestByAlcohol &&
                            <div>
                                <p>Bare <strong>{hallOfFameProducts.cheapestByAlcohol.LiterPriceAlcohol} kr</strong> per liter ren alkohol</p>
                                <Product product={hallOfFameProducts.cheapestByAlcohol} highlightProduct={highlightProduct.bind(this)} />
                            </div>
                        }
                    </li>
                    <li className="famed-product largestDiscount">
                        <FontAwesomeIcon icon={faMoneyBillWave} size="3x" />
                        <h3 className="gold" >Beste tilbud</h3>
                        {hallOfFameProducts?.largestDiscount &&
                            <div>
                                <p>Pris redusert med hele <strong>{(100 - hallOfFameProducts.largestDiscount.PriceChange).toFixed(1)}%</strong></p>
                                <Product product={hallOfFameProducts.largestDiscount} highlightProduct={highlightProduct.bind(this)} />
                            </div>
                        }
                    </li>
                    <li className="famed-product mostVolatile">
                        <FontAwesomeIcon icon={faChartLine} size="3x" />
                        <h3 className="gold" >Flest prisendringer</h3>
                        {hallOfFameProducts?.mostVolatile &&
                            <div>
                                <p>Gått opp eller ned i pris hele <br /> <strong>{hallOfFameProducts.mostVolatile.PriceChanges} ganger!</strong></p>
                                <Product product={hallOfFameProducts.mostVolatile} highlightProduct={highlightProduct.bind(this)} />
                            </div>
                        }
                    </li>
                    <li className="famed-product highestRated">
                        <FontAwesomeIcon icon={faCrown} size="3x" />
                        <h3 className="gold" >Høyest vurdert</h3>
                        {hallOfFameProducts?.highestRated &&
                            < div >
                                <p>Best av alle, med <strong>{hallOfFameProducts.highestRated.Rating} av 100</strong></p>
                                <Product product={hallOfFameProducts.highestRated} highlightProduct={highlightProduct.bind(this)} />
                            </div>
                        }
                    </li>
                </ul >
            }

            <ProductPopUp product={highlightedProduct} notification={notification} highlightProduct={highlightProduct.bind(this)} />
            <Notification ref={notification} />
        </div >
    );
}

export default HallOfFame;
