import React, { useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";
import { Box, Chip, FormControl, Input, InputLabel, MenuItem, OutlinedInput, Select, ThemeProvider } from "@mui/material";
import "./css/filter.css";
import { Delete, RemoveCircle, RemoveCircleTwoTone } from "@mui/icons-material";


const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  };
const FilterV2 = ({
    items = [],
    selectedItems = [],
    propSlug,
    label,
    handleFilterChange
}) => {
    
    const [selectedOptions, setSelectedOptions] = useState([]);

    const handleChange = (e) => {        
        
        setSelectedOptions(e.target.value);
        handleFilterChange(propSlug, e.target.value);

        firebase.analytics().logEvent(`filter_${propSlug}`);
    }

    const remove = (value) => {
        var selected  = selectedOptions.filter(x => x !== value);
        setSelectedOptions(selected)
        handleFilterChange(propSlug, selected);
    }

    useEffect(() => {
        if(selectedItems.length !== selectedOptions.length)
            setSelectedOptions(selectedItems);
    }, [selectedItems])

    return (
        <div className={"filter " + propSlug} >
            <FormControl >
                <InputLabel  className={`multiple-chip-label-${propSlug}`}>Filtrer på {label}</InputLabel>
                <Select
                labelId={`multiple-chip-label-${propSlug}`}
                id={`multiple-chip-${propSlug}`}
                multiple
                value={selectedOptions}
                onChange={handleChange}
                MenuProps={MenuProps}
                input={<Input id={`select-multiple-chip-${propSlug}`} label={"Filtrer på "+ label} />}
                renderValue={(selected) => {
                    var selectedItems = items.filter(x => selected.includes(x.value));
                    return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedItems.map((x) => (
                            <Chip 
                            key={(x.value)} 
                            label={ x.count ? `${x.label}  (${x.count})`: x.label}
                            onDelete={() => 1}
                            onMouseDown={(e) => {remove(x.value); e.stopPropagation()}}
                            >
                                 </Chip>
                            ))}
                        </Box>
                    )}
                }
                >
                {items.filter(i => !selectedOptions.includes(i.value) ).map((item) => (
                    <MenuItem
                    disabled={item.count === 0}
                    key={item.value}
                    value={item.value}
                    >
                        
                    { item.count ? `${item.label}  (${item.count})`: item.label}
                    </MenuItem>
                ))}
                </Select>
            </FormControl>
        </div>
    );
}

export default FilterV2;

