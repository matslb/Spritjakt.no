import React from "react";
import Select from 'react-select'
import sortArray from "sort-array";

class Filter extends React.Component {
    handleChange = (options) => {
        let list = [];
        if (options && options.length > 0) {
            options.map(s => list.push(s.value));
        }
        this.props.handleFilterChange(this.props.propSlug, list);
    }

    render() {
        const { items = {}, selectedItems = [], propSlug, label } = this.props;
        let options = [];
        let selectedOptions = [];
        Object.keys(items).forEach(id => {
            let item = items[id];
            let option = {
                value: id,
                label: id + " (" + item.count + ")",
                noResults: item.count === 0
            }
            options.push(option);
            if (selectedItems.includes(id)) {
                selectedOptions.push(option);
            }
        });
        sortArray(options, {
            by: ["noResults", "value"]
        })
        return (
            <div className={"filter " + propSlug} >
                <label>
                    <span>{label}</span>
                    <Select
                        value={selectedOptions}
                        onChange={this.handleChange}
                        isMulti
                        onMenuClose={() => document.activeElement.blur()}
                        menuShouldScrollIntoView={true}
                        options={options}
                        noOptionsMessage={() => "Fant niks og nada"}
                        placeholder={"Filtrer på " + label}
                        classNamePrefix="select"
                        theme={theme => ({
                            ...theme,
                            colors: {
                                ...theme.colors,
                                primary: '#d0b55e',
                            },
                        })}
                    />
                </label>
            </div>
        );
    }
}

export default Filter;
