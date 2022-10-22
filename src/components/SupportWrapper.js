import React from "react";
import { isMobile } from "react-device-detect";
import "./css/supportWrapper.css";

const SupportWrapper = () => {
    return (
        <section className="SupportWrapper ">
            <h3>Støtt Spritjakt</h3>
            <div>
                <video style={{ width: "100%" }} loading={'lazy'} autoPlay loop muted playsInline>
                    <source src="/money_please.webm" type="video/webm" />
                    <source src="/money_please.mp4" type="video/mp4" />
                </video>
            </div>
            <p>Hvis du syns dette er en kul tjeneste så hadde jeg satt uhorvelig stor pris på en donasjon eller et lite kjøp. <br />
                Da kan jeg fortsette utviklingen og holde tjenesten gratis!</p>
            <div className="content">
                <article className="vipps">
                    <h4>Du kan donere noen kronestykker?</h4>
                    <img loading={'lazy'} className="vipps" src="/vipps.png" alt="Vipps QR-kode" width="175px" height="356px" />
                    {isMobile ?
                        <a href="https://qr.vipps.no/28/2/05/031/kix5KzyDM" rel="noopener noreferrer" className="clickable vipps">Støtt meg på Vipps</a>
                        :
                        <div>
                            <span className="vippsnumber">#691500</span>
                        </div>
                    }
                </article>
                <article>
                    <h4>...eller så har Spritjakt masse kul merch</h4>
                    <p>Du får noe stilig stæsj, og jeg får en slant som vil hjelpe med vedlikehold og hosting</p>
                    <img loading={'lazy'} src="https://spritjakt.no/images/productimages.jpg" alt="produktbilder" width="400px" />
                    <a className="clickable" href="https://butikk.spritjakt.no" >Sjekk ut Spritjaktbutikken</a>
                </article>
            </div>
        </section>
    );
}

export default SupportWrapper;
