import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Product from "./Product";

const FamedProduct = ({
    icon,
    product,
    highlightProduct,
    title,
    positive,
    description
}) => {

    return (
        <li className="famed-product">
            <FontAwesomeIcon icon={icon} size="3x" />
            <h3 className={positive ? "gold" : "dark"} >{title}</h3>
            <div>
                <p>{description}</p>
                <Product product={product} highlightProduct={highlightProduct.bind(this)} />
            </div>
        </li>
    );
}

export default FamedProduct;
