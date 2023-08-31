import React, { useEffect, useState } from "react";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";
import { Box, Chip, FormControl, Input, InputLabel, MenuItem, OutlinedInput, Select, ThemeProvider } from "@mui/material";
import { FilterListOutlined, Remove, RemoveCircle } from '@mui/icons-material';
import { theme } from "../utils/utils";
import { isMobile } from "react-device-detect";

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;

const FilterV2 = ({
    items = [],
    selectedItems = [],
    propSlug,
    label,
    handleFilterChange
}) => {
    
    const [selectedOptions, setSelectedOptions] = useState([]);

    const MenuProps = {
        PaperProps: {
          style: {
            maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
            width: 250,
          },
        },
      };

    

    const handleChange = (e) => {        
        
        setSelectedOptions(e.target.value);
        handleFilterChange(propSlug, e.target.value);

        firebase.analytics().logEvent(`filter_${propSlug}`);
    }

    const remove = (e) => {
        selectedOptions.shift(e.target.value, 1);
        setSelectedOptions(selectedOptions)
        handleFilterChange(propSlug, selectedOptions);
    }

    return (
        <div className={"filter " + propSlug} >
            <FormControl sx={{ width: 500 }}>
                <InputLabel className={`multiple-chip-label-${propSlug}`}>Filtrer på {label}</InputLabel>
                <Select
                labelId={`multiple-chip-label-${propSlug}`}
                id={`multiple-chip-${propSlug}`}
                multiple
                value={selectedOptions}
                onChange={handleChange}
                input={<Input id={`select-multiple-chip-${propSlug}`} label={"Filtrer på "+ label} />}
                renderValue={(selected) => {
                    var selectedItems = items.filter(x => selected.includes(x.value));
                    return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedItems.map((x) => (
                            <Chip 
                            key={(x.value)} 
                            label={x.label}
                            deleteIcon={
                                <RemoveCircle
                                onMouseDown={(event) => selectedOptions.length > 0 ? event.stopPropagation() : ""}
                                />
                            }
                            onDelete={remove} 
                            />
                            ))}
                        </Box>
                    )}
                }
                >
                {items.map((item) => (
                    <MenuItem
                    key={item.value}
                    value={item.value}
                    >
                    {item.label}
                    </MenuItem>
                ))}
                </Select>
            </FormControl>
        </div>
    );
}

export default FilterV2;
