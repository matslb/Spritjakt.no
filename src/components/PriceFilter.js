import { TextField } from "@mui/material";
import React, { useState } from "react";
import "./css/priceFilter.css";
import { useEffect } from "react";

const PriceFilter = ({
    SetPriceFilter,
    min,
    max
}) => {
    useEffect( () => {
        let shrinkUpdate = Object.assign({},  shrink);
        if(max !== undefined && maxPrice === undefined){
            setMaxPrice(max);          
            shrinkUpdate.max = true;
        }

        if(min !== undefined && minPrice === undefined){
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
      }, 250))
    }
   const ShouldShrink = (x) => {return x ? { shrink: true } : {}};
    return (
        <div className='price'>
            <label>
                <span>Pris</span>
            </label>
            <div className="price-wrapper">
            <TextField
                id="min-price"
                label="Min"
                type="number"
                InputLabelProps={ShouldShrink(shrink.min)} 
                value={minPrice}
                variant="standard"
                onChange={onMinChange}
                InputProps={{ inputProps: { min: 0, max: max,  step: 25} }}
                />
            <TextField
                id="max-price"
                label="Maks"
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
