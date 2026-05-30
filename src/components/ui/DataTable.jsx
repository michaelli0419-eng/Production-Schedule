export default function DataTable({
  columns = [],
  data = [],
  loading = false,
  emptyText = 'No data available.',
  onRowClick,
  sortKey,
  sortDir = 'asc',
  onSort,
  stickyHeader = false,
}) {
  const handleSort = (col) => {
    if (!col.sortable || !onSort) return;
    const newDir = sortKey === col.key && sortDir === 'asc' ? 'desc' : 'asc';
    onSort(col.key, newDir);
  };

  const SortIcon = ({ colKey }) => {
    if (sortKey !== colKey) {
      return (
        <svg className="ui-datatable__sort-icon ui-datatable__sort-icon--neutral" width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M3 4.5L6 1.5L9 4.5M3 7.5L6 10.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );
    }
    return sortDir === 'asc' ? (
      <svg className="ui-datatable__sort-icon ui-datatable__sort-icon--active" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 7.5L6 4.5L9 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ) : (
      <svg className="ui-datatable__sort-icon ui-datatable__sort-icon--active" width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  };

  const SkeletonRow = ({ index }) => (
    <tr className="ui-datatable__row ui-datatable__row--skeleton" key={`skel-${index}`}>
      {columns.map((col) => (
        <td key={col.key} className="ui-datatable__cell" style={col.width ? { width: col.width } : {}}>
          <div className="ui-datatable__shimmer" />
        </td>
      ))}
    </tr>
  );

  return (
    <div className="ui-datatable-wrapper">
      <table className="ui-datatable">
        <thead className={`ui-datatable__head ${stickyHeader ? 'ui-datatable__head--sticky' : ''}`}>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`ui-datatable__th ${col.sortable ? 'ui-datatable__th--sortable' : ''} ${sortKey === col.key ? 'ui-datatable__th--sorted' : ''}`}
                style={col.width ? { width: col.width } : {}}
                onClick={() => handleSort(col)}
                aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
              >
                <span className="ui-datatable__th-inner">
                  {col.label}
                  {col.sortable && <SortIcon colKey={col.key} />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="ui-datatable__body">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} index={i} />)
          ) : data.length === 0 ? (
            <tr className="ui-datatable__row ui-datatable__row--empty">
              <td colSpan={columns.length} className="ui-datatable__empty-cell">
                <div className="ui-datatable__empty">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 12h24" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M10 18h12M10 22h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>{emptyText}</span>
                </div>
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={row.id ?? rowIndex}
                className={`ui-datatable__row ${onRowClick ? 'ui-datatable__row--clickable' : ''}`}
                onClick={() => onRowClick?.(row)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onRowClick(row); } : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className="ui-datatable__cell"
                    style={col.width ? { width: col.width } : {}}
                  >
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
