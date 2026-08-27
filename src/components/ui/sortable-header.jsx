import React from 'react';

export function SortableHeader({ sortKey, activeKey, direction, onSort, className = '', children }) {
  const active = activeKey === sortKey;
  const nextDirection = active && direction === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className={className}
      data-sortable="true"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="absolute inset-0 w-full cursor-pointer text-left"
        aria-label={`Sort by ${typeof children === 'string' ? children : sortKey} ${nextDirection === 'asc' ? 'ascending' : 'descending'}`}
        onClick={() => onSort(sortKey, nextDirection)}
      >
        <span className="invisible">{children}</span>
      </button>
      <span>{children}</span>
    </th>
  );
}

export function useUrlSorting(searchParams, setSearchParams, defaultKey = 'createdAt') {
  const sortBy = searchParams.get('sortBy') || defaultKey;
  const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
  const onSort = (key, order) => {
    const next = new URLSearchParams(searchParams);
    next.set('sortBy', key);
    next.set('sortOrder', order);
    next.delete('page');
    setSearchParams(next);
  };
  return { sortBy, sortOrder, onSort };
}
