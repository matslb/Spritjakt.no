import { NativeSelect } from "@mui/material";
import React, { useEffect, useState } from "react";
import queryString from "query-string";

const SavedFilterList = ({
    filters,
    stores,
    setPage,
    currentFilterExists
}) => {
    const [filterOptions, setFilterOptions] = useState([]);
    const [selected, setSelected] = useState(undefined);
    useEffect(() => {
        if (stores.length == 0) return;
        let filterOptions = filters.map((f, i) => {
            var storeList = f.stores?.map(id => {
                let name = stores.filter(s => s.storeId == id)[0].storeName;
                return name.substring(name.indexOf(", ") + 1);
            })?.join(", ");
            return {
                value: i,
                label: [storeList, f.countries.join(", "), f.productTypes.join(", ")].filter(x => x.length > 0).join(" | ")
            };
        })
        filterOptions.unshift({ value: 999, label: "Velg et lagret filter" });
        setFilterOptions(filterOptions);
    }, [filters, stores])

    useEffect(() => {
        setSelected(currentFilterExists ? selected : 999);
    }, [currentFilterExists]);

    const handleChange = (e) => {
        let filter = filters[e?.target?.value];
        if (filter) {
            setSelected(e.target.value);
            let query = queryString.parse(window.location.search, { arrayFormat: 'comma' });
            query.stores = filter.stores;
            query.types = filter.productTypes;
            query.countries = filter.countries;

            let params = queryString.stringify(query, { arrayFormat: 'comma' });
            window.history.replaceState('', '', '?' + params);
        }
        else {
            setSelected(999);
            window.history.replaceState('', '', '?');
        }

        setPage(1);
    }

    return (
        <div className={"savedFilters"} >
            <label>
                <span>Lagrede filtre</span>
                <NativeSelect
                    value={selected}
                    onChange={handleChange}
                >
                    {filterOptions.map(option => {
                        if (option !== undefined) {
                            return <option key={option?.value} value={option?.value}>{option?.label}</option>
                        }
                        return null;
                    })}
                </NativeSelect>
            </label>
        </div>
    );
}

export default SavedFilterList;
