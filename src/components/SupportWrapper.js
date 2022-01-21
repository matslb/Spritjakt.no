import React from "react";
import "./css/supportWrapper.css";

const SupportWrapper = () => {
    return (
        <div className="SupportWrapper ">
            <div className="content">
                <h3>Spritjakt har fått masse kul merch!</h3>
                <p>Hvis du syns dette er en kul tjeneste du bruker ofte, så hadde jeg satt uhorvelig stor pris på et lite kjøp.</p>
                <p>Du får noe stilig stæsj, og jeg får en slant som vil hjelpe med vedlikehold og hosting</p>
                <strong>Kjøp ting du ikke trenger, til støtte for spritjakt.no</strong>
                <br />
                <div>
                    <img loading={'lazy'} src="https://spritjakt.no/images/productimages.jpg" alt="produktbilder" width="400px" />
                    <a className="clickable" href="https://butikk.spritjakt.no" >Sjekk ut Spritjaktbutikken</a>
                    <video style={{ width: "100%" }} loading={'lazy'} autoPlay loop muted playsInline>
                        <source src="/money_please.webm" type="video/webm" />
                        <source src="/money_please.mp4" type="video/mp4" />
                    </video>
                </div>
                <br />
            </div>
        </div>
    );
}

export default SupportWrapper;
