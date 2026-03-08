type PaginationControlsProps = {
  currentPage: number
  totalItems: number
  pageSize?: number
  maxPageButtons?: number
  onPageChange: (page: number) => void
  className?: string
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const buildPageWindow = (currentPage: number, totalPages: number, maxPageButtons: number) => {
  const pageWindow = Math.max(1, maxPageButtons)
  if (totalPages <= pageWindow) {
    return { start: 1, end: totalPages }
  }

  const halfWindow = Math.floor(pageWindow / 2)
  let start = currentPage - halfWindow
  let end = start + pageWindow - 1

  if (start < 1) {
    start = 1
    end = pageWindow
  }

  if (end > totalPages) {
    end = totalPages
    start = Math.max(1, end - pageWindow + 1)
  }

  return { start, end }
}

const PaginationControls = ({
  currentPage,
  totalItems,
  pageSize = 10,
  maxPageButtons = 10,
  onPageChange,
  className,
}: PaginationControlsProps) => {
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / safePageSize))
  const safeCurrentPage = clamp(Math.floor(currentPage) || 1, 1, totalPages)
  const { start, end } = buildPageWindow(safeCurrentPage, totalPages, maxPageButtons)
  const pageNumbers = Array.from({ length: end - start + 1 }, (_, index) => start + index)

  const handlePageChange = (page: number) => {
    const nextPage = clamp(page, 1, totalPages)
    if (nextPage !== safeCurrentPage) {
      onPageChange(nextPage)
    }
  }

  return (
    <nav className={`reference-pagination ${className ?? ''}`.trim()} aria-label="Pagination controls">
      <p className="reference-pagination-info">
        Page {safeCurrentPage} of {totalPages} · {totalItems} item{totalItems === 1 ? '' : 's'}
      </p>
      <div className="reference-pagination-controls">
        <button
          type="button"
          className="reference-pagination-btn"
          onClick={() => handlePageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          aria-label="Go to previous page"
        >
          Prev
        </button>
        {pageNumbers.map((pageNumber) => (
          <button
            key={pageNumber}
            type="button"
            className={`reference-pagination-btn ${pageNumber === safeCurrentPage ? 'is-active' : ''}`}
            onClick={() => handlePageChange(pageNumber)}
            aria-label={`Go to page ${pageNumber}`}
            aria-current={pageNumber === safeCurrentPage ? 'page' : undefined}
          >
            {pageNumber}
          </button>
        ))}
        <button
          type="button"
          className="reference-pagination-btn"
          onClick={() => handlePageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          aria-label="Go to next page"
        >
          Next
        </button>
      </div>
    </nav>
  )
}

export type { PaginationControlsProps }
export default PaginationControls
