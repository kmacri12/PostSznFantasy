import React, { useEffect, useMemo } from "react";
import {
  useTable,
  useSortBy,
  usePagination,
  useGlobalFilter,
} from "react-table";
import axios from "axios";

function Players() {
  // Table data and columns state
  const [data, setData] = React.useState([]);
  const [columns, setColumns] = React.useState([]);

  // Fetch data from Flask backend on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.put(
          "http://127.0.0.1:5000/api/admin/update/nfl_players"
        );

        setData(response.data);

        // Specify the headers you want to include
        const includedHeaders = ["longName", "pos", "team"];

        const filteredColumns = Object.keys(response.data[0])
          .filter((key) => includedHeaders.includes(key))
          .map((key) => ({
            Header: key,
            accessor: key,
          }));

        setColumns(filteredColumns);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);

  // Table instance
  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    nextPage,
    previousPage,
    canNextPage,
    canPreviousPage,
    state,
    setGlobalFilter,
    prepareRow,
  } = useTable(
    { columns, data, initialState: { pageIndex: 0, pageSize: 25 } },
    useGlobalFilter,
    useSortBy,
    usePagination
  );

  // Memoized table instance for performance optimization
  const memoizedTable = useMemo(() => {
    return (
      <table {...getTableProps()}>
        <thead>
          {headerGroups.map((headerGroup) => (
            <tr {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column) => (
                <th {...column.getHeaderProps(column.getSortByToggleProps())}>
                  {column.render("Header")}
                  <span>
                    {column.isSorted
                      ? column.isSortedDesc
                        ? " 🔽"
                        : " 🔼"
                      : ""}
                  </span>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody {...getTableBodyProps()}>
          {page.map((row) => {
            prepareRow(row);
            return (
              <tr {...row.getRowProps()}>
                {row.cells.map((cell) => (
                  <td {...cell.getCellProps()}>{cell.render("Cell")}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }, [getTableProps, getTableBodyProps, headerGroups, page, prepareRow]);

  return (
    <div>
      {/* Global filter input */}
      <input
        type="text"
        value={state.globalFilter || ""}
        onChange={(e) => setGlobalFilter(e.target.value)}
        placeholder="Search..."
      />
      {memoizedTable}
      <div>
        {/* Pagination controls */}
        <button onClick={() => previousPage()} disabled={!canPreviousPage}>
          Previous
        </button>
        <span>
          Page{" "}
          <strong>
            {state.pageIndex + 1} of{" "}
            {state.pageOptions ? state.pageOptions.length : 1}
          </strong>{" "}
        </span>
        <button onClick={() => nextPage()} disabled={!canNextPage}>
          Next
        </button>
      </div>
    </div>
  );
}

export default Players;
