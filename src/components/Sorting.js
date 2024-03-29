import { NativeSelect } from "@mui/material";
import { sortOptions } from "../utils/utils";

const Sorting = ({ sort, handleSortChange }) => {
  return (
    <div className="sorting">
      <NativeSelect
        value={sort}
        aria-label="Sortering"
        onChange={handleSortChange}
        inputProps={{
          name: "sorting",
          id: "sorting",
        }}
      >
        {sortOptions.map((option) => {
          if (option !== undefined) {
            return (
              <option key={option?.value} value={option?.value}>
                {option?.label}
              </option>
            );
          }
          return null;
        })}
      </NativeSelect>
    </div>
  );
};

export default Sorting;
