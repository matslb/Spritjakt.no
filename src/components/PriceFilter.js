import { TextField } from "@mui/material";
import React, { useState } from "react";
import "./css/priceFilter.css";
import { useEffect } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";

const PriceFilter = ({
    SetPriceFilter,
    min,
    max
}) => {
    useEffect( () => {
        let shrinkUpdate = Object.assign({},  shrink);
        if(max !== null && maxPrice === undefined){
            setMaxPrice(max);          
            shrinkUpdate.max = true;
        }

        if(min !== null && minPrice === undefined){
            setMinPrice(min);
            shrinkUpdate.min = true;
        }
        setShrink(shrinkUpdate);

    }, [min, max]);
    const [timeout, setTimeOut] = useState(null);
    const [maxPrice, setMaxPrice] = useState();
    const [minPrice, setMinPrice] = useState();
    const [shrink, setShrink] = useState({min: false, max: false});

    const onMinChange = (e) => {
        setMinPrice(e.target.value);
        setShrink({min: false, max: shrink.max});
        onchange(e.target.value, maxPrice);
    }
    
    const onMaxChange = (e) => {
        setMaxPrice(e.target.value);
        setShrink({min: shrink.min, max: false});
        onchange(minPrice, e.target.value);
    }

    const onchange = (min, max) => {
      clearTimeout(timeout);
  
      setTimeOut(setTimeout(() => {
            SetPriceFilter(min, max);
            firebase.analytics().logEvent(`filter_price`);
        }, 250))
    }
   const ShouldShrink = (x) => {return x ? { shrink: true } : {}};
    return (
        <div className='price'>
            <div className="price-wrapper">
            <TextField
                id="min-price"
                label="Pris - Min"
                type="number"
                InputLabelProps={ShouldShrink(shrink.min)} 
                value={minPrice}
                variant="standard"
                onChange={onMinChange}
                InputProps={{ inputProps: { min: 0, max: max,  step: 25} }}
                />
            <TextField
                id="max-price"
                label="Pris - Maks"
                type="number"
                InputLabelProps={ShouldShrink(shrink.max)} 
                value={maxPrice}
                variant="standard"
                onChange={onMaxChange}
                InputProps={{ inputProps: { min: min, max: 999999, step: 25 } }}
                />
            </div>
        </div>
    );
}

export default PriceFilter;
