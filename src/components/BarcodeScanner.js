import React, { useState, useRef, useCallback, useEffect } from "react";
import { faBarcode, faCamera, faLightbulb, faQrcode, faRobot, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./css/barcodeScanner.css";
import Scanner from "./Scanner";
import SpritjaktClient from "../services/spritjaktClient";
import Quagga from "@ericblade/quagga2";
import debounce from 'lodash.debounce';
import firebase from "firebase/app";
import "firebase/analytics";
import Notification from "./Notification";
import ProductPopUp from "./ProductPopUp";


const BarcodeScanner = () => {

    const [scanning, setScanning] = useState(false);
    const [isActive, setIsActive] = useState(false);
    const [cameraId, setCameraId] = useState(false);
    const [hasCamera, sethasCamera] = useState(false);
    const [useTorch, setUseTorch] = useState(false);
    const [product, setProduct] = useState(null);
    const scannerRef = useRef(null);
    const notificationRef = useRef(null);

    useEffect(() => {
        checkCamera();
    }, []);

    const checkCamera = async () => {
        const videoDevices = await Quagga.CameraAccess.enumerateVideoDevices();
        sethasCamera(videoDevices.length > 0);
    }

    const updateResult = async (result) => {
        if (result === null) return;
        let id = await SpritjaktClient.FetchIdByBarcode(result);
        if (id) {
            let product = await SpritjaktClient.FetchProductById(id);
            if (product != undefined) {
                setProduct(product);
                closeScanner();
                firebase.analytics().logEvent("barcodescan_successfull");
                notificationRef.current.setNotification(null, "Jeg fant, jeg fant!", "success");
            }
        } else {
            firebase.analytics().logEvent("barcodescan_error");
            notificationRef.current.setNotification(null, "Fant ikke produktet", "error");
        }
    }

    const debouncedChangeHandler = useCallback(debounce(updateResult, 250), [updateResult, 250]);

    const openBarcodeScanner = async (e) => {
        let error = false;
        let event = Object.assign({}, e);
        const videoDevices = await Quagga.CameraAccess.enumerateVideoDevices();
        if (videoDevices?.length > 0) {
            setCameraId(videoDevices[videoDevices.length - 1].deviceId);
        }

        await navigator?.permissions?.query({ name: 'camera' }).then(res => {
            if (res.state == "denied") {
                error = true;
            }
        });
        if (error == false) {
            setIsActive(true);
            setScanning(true);
        }
        else
            notificationRef.current.setNotification(event, "Du må tillate bruk av kamera", "error");
    }

    const closeScanner = () => {
        setIsActive(false);
        setScanning(false);
        window.document.querySelector(".VideoWrapper video")?.remove();
        window.document.querySelector(".VideoWrapper drawingBuffer")?.remove();
    }

    return (
        <div className="BarcodeScanner">
            {hasCamera &&
                <button aria-label="Scan strekkode" onClick={openBarcodeScanner} className="clickable dark iconBtn">
                    <FontAwesomeIcon size="2x" icon={faQrcode} />
                </button>
            }
            {isActive &&
                <div className={"ScannerPopup " + (isActive ? "active" : "")}>
                    {scanning &&
                        <div className="ScanningDescription scannerEffect">
                            <FontAwesomeIcon size="3x" icon={faRobot} />
                            <h3>Biip baap boop</h3>
                            <h4>...leter etter strekkoder...</h4>
                        </div>
                    }
                    <div ref={scannerRef} className="VideoWrapper" >
                        {scanning &&
                            <button aria-label="Bruk lys" onClick={openBarcodeScanner} className={"clickable iconBtn torch " + (useTorch ? "active" : "")}>
                                <FontAwesomeIcon size="2x" onClick={() => setUseTorch(!useTorch)} icon={faLightbulb} />
                            </button>
                        }
                        {scanning &&
                            <Scanner className="Scanner" hasProduct={product !== null} useTorch={useTorch} cameraId={cameraId} scannerRef={scannerRef} onDetected={debouncedChangeHandler} />
                        }
                    </div>
                    {scanning &&
                        <button aria-label="Tilbake" name="closeGraph" onClick={closeScanner} className="iconBtn productNav close">
                            <FontAwesomeIcon size="2x" icon={faTimesCircle} />
                        </button>
                    }
                </div>
            }
            {product != null &&
                <ProductPopUp
                    product={product}
                    notification={notificationRef}
                    highlightProduct={() => setProduct(null)}
                />
            }
            <Notification ref={notificationRef} />
        </div >
    );
}

export default BarcodeScanner;
