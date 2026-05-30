import { useState, useCallback } from 'react';

export function usePagination({ pageSize = 25, initialPage = 0 } = {}) {
  const [page, setPageState] = useState(initialPage);

  const setPage = useCallback((p) => {
    setPageState(p);
  }, []);

  const nextPage = useCallback(() => {
    setPageState((prev) => prev + 1);
  }, []);

  const prevPage = useCallback(() => {
    setPageState((prev) => Math.max(0, prev - 1));
  }, []);

  const reset = useCallback(() => {
    setPageState(initialPage);
  }, [initialPage]);

  return {
    page,
    pageSize,
    offset: page * pageSize,
    setPage,
    nextPage,
    prevPage,
    reset,
  };
}
