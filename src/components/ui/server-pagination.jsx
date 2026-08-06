import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { SearchableSelect } from './searchable-select';

const getPageItems = (currentPage, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const sorted = [...pages].filter((item) => item > 0 && item <= totalPages).sort((a, b) => a - b);
  return sorted.reduce((items, item, index) => {
    if (index && item - sorted[index - 1] > 1) items.push('ellipsis');
    items.push(item);
    return items;
  }, []);
};


export function ServerPagination({
  page = 1,
  totalPages = 1,
  total = 0,
  pageSize = 10,
  itemLabel = 'records',
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className
}) {
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const last = Math.min(page * pageSize, total);
  const pageItems = getPageItems(page, Math.max(1, totalPages));

  return (
    <footer className={cn('surface-card flex min-h-11 shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white px-3 py-2 text-xs', className)}>
      <div className="flex items-center gap-3">
        <p className="text-slate-500">
          Showing <span className="font-semibold tabular-nums text-slate-700">{first}–{last}</span> of{' '}
          <span className="font-semibold tabular-nums text-slate-700">{total}</span> {itemLabel}
        </p>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
            <span>Per page:</span>
            <div className="w-20">
              <SearchableSelect
                options={pageSizeOptions.map((opt) => ({ label: `${opt}`, value: opt }))}
                value={pageSize}
                onChange={(val) => onPageSizeChange(Number(val))}
                size="sm"
                searchable={false}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1 rounded-lg bg-slate-100/80 p-1">
        <PageButton disabled={page <= 1} onClick={() => onPageChange(page - 1)} ariaLabel="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" /><span className="hidden lg:inline">Previous</span>
        </PageButton>
        <div className="hidden flex-wrap items-center gap-1 sm:flex">
          {pageItems.map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="flex h-7 w-6 items-center justify-center text-xs text-slate-400">…</span>
          ) : (
            <button
              key={item}
              type="button"
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange(item)}
              className={cn(
                'flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] font-bold transition',
                item === page
                  ? 'border-teal-700 bg-teal-700 text-white shadow-sm'
                  : 'border-transparent bg-white text-slate-600 hover:border-teal-300 hover:text-teal-700'
              )}
            >
              {item}
            </button>
          ))}
        </div>
        <span className="px-1 text-[11px] font-semibold text-slate-600 sm:hidden">{page}/{Math.max(1, totalPages)}</span>
        <PageButton disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} ariaLabel="Next page">
          <span className="hidden lg:inline">Next</span><ChevronRight className="h-3.5 w-3.5" />
        </PageButton>
      </div>
    </footer>
  );
}


function PageButton({ disabled, onClick, ariaLabel, children }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className="inline-flex h-7 items-center justify-center gap-1 rounded-md border border-transparent bg-white px-2 text-[11px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
