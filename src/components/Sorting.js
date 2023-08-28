import { NativeSelect } from "@mui/material";
import { sortOptions } from "../utils/utils";
import { isMobile } from "react-device-detect";

const Sorting = ({
  sort,
  handleSortChange
}) => {
  return (
        <div className="sorting">
        <label htmlFor="sorting">
        {!isMobile &&
            "Sortering"
        }
        <NativeSelect
            value={sort}
            aria-label="Sortering"
            onChange={handleSortChange}
            inputProps={{
            name: 'sorting',
            id: 'sorting',
            }}
        >
            {sortOptions.map(option => {
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

export default Sorting;
