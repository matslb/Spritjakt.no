import React, { useEffect, useState } from "react";
import Select from "react-select";
import sortArray from "sort-array";
import firebase from "firebase/compat/app";
import "firebase/compat/analytics";

const Filter = ({
  items,
  selectedItems,
  propSlug,
  label,
  handleFilterChange,
}) => {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [options, setOptions] = useState([]);

  const handleChange = (options) => {
    let list = [];
    if (options && options.length > 0) {
      options.map((s) => list.push(s.value));
    }
    handleFilterChange(propSlug, list);
    firebase.analytics().logEvent(`filter_${propSlug}`);
  };

  useEffect(() => {
    let options = [];
    let selectedOptions = [];
    Object.keys(items).forEach((id) => {
      let item = items[id];
      let option = {
        value: id,
        label: id + " (" + item.count + ")",
        noResults: item.count === 0,
      };
      options.push(option);
      if (selectedItems.includes(id)) {
        selectedOptions.push(option);
      }
    });
    sortArray(options, {
      by: ["noResults", "value"],
    });
    setSelectedOptions(selectedOptions);
    setOptions(options);
  }, [items, selectedItems]);

  return (
    <div className={"filter " + propSlug}>
      <label>
        <span>{label}</span>
        <Select
          value={selectedOptions}
          onChange={handleChange}
          isMulti
          onMenuClose={() => document.activeElement.blur()}
          menuShouldScrollIntoView={true}
          options={options}
          noOptionsMessage={() => "Fant niks og nada"}
          placeholder={"Filtrer på " + label.toLowerCase()}
          classNamePrefix="select"
          theme={(theme) => ({
            ...theme,
            colors: {
              ...theme.colors,
              primary: "#d0b55e",
            },
          })}
        />
      </label>
    </div>
  );
};

export default Filter;
