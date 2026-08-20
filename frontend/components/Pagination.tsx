import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalItems: number;
  itemsPerPage?: number;
  setPage: React.Dispatch<React.SetStateAction<number>> | ((page: number) => void);
  itemLabel?: string;
  theme?: 'dark' | 'light';
}

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalItems,
  itemsPerPage = 20,
  setPage,
  itemLabel = 'items',
  theme = 'dark',
}) => {
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  if (totalItems <= itemsPerPage) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 border-t pt-5 mt-4 ${
        theme === 'dark' ? 'border-[#1e2433]' : 'border-slate-200'
      }`}
    >
      <div className={`text-xs ${theme === 'dark' ? 'text-[#94a3b8]' : 'text-slate-600'}`}>
        Showing{' '}
        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {(page - 1) * itemsPerPage + 1}
        </span>{' '}
        to{' '}
        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {Math.min(page * itemsPerPage, totalItems)}
        </span>{' '}
        of{' '}
        <span className={`font-semibold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {totalItems}
        </span>{' '}
        {itemLabel}
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => (typeof setPage === 'function' ? (setPage as any)((p: number) => Math.max(1, p - 1)) : null)}
          disabled={page === 1}
          className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
            theme === 'dark'
              ? 'border-[#1e2433] bg-[#11141c] text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ChevronLeft size={14} />
          <span>Previous</span>
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
            const isCurrent = pageNum === page;
            return (
              <button
                key={pageNum}
                onClick={() => (typeof setPage === 'function' ? (setPage as any)(pageNum) : null)}
                className={`min-w-[32px] rounded-md px-2.5 py-1.5 font-mono text-xs font-semibold transition ${
                  isCurrent
                    ? theme === 'dark'
                      ? 'bg-white text-black'
                      : 'bg-slate-900 text-white'
                    : theme === 'dark'
                    ? 'bg-[#11141c] text-[#94a3b8] hover:bg-[#161a25] hover:text-white border border-[#1e2433]'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => (typeof setPage === 'function' ? (setPage as any)((p: number) => Math.min(totalPages, p + 1)) : null)}
          disabled={page === totalPages}
          className={`flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
            theme === 'dark'
              ? 'border-[#1e2433] bg-[#11141c] text-[#94a3b8] hover:bg-[#161a25] hover:text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Next</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};
