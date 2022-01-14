import React from "react";
import "./css/supportWrapper.css";

const SupportWrapper = () => {
    return (
        <div className="SupportWrapper ">
            <div className="content">
                <strong>Spritjakt har fått masse kul merch!</strong><br />
                <p>Kjøp ting du ikke trenger, til støtte for spritjakt.no</p>
                <br />
                <div>
                    <img loading={'lazy'} src="https://spritjakt.no/images/productimages.jpg" alt="produktbilder" width="400px" />
                    <a className="clickable" href="https://butikk.spritjakt.no" >Sjekk ut Spritjaktbutikken</a>
                </div>
                <br />
            </div>
        </div>
    );
}

export default SupportWrapper;
