type DashboardTopBarProps = {
  title: string
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
}

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </svg>
)

const DashboardTopBar = ({
  title,
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records',
}: DashboardTopBarProps) => {
  return (
    <section className="reference-topbar">
      <h1 className="reference-page-title">{title}</h1>

      <label className="reference-search" htmlFor="reference-dashboard-search">
        <span className="text-[color:var(--agent-muted-soft)]" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          id="reference-dashboard-search"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          className="reference-search-input"
        />
      </label>
    </section>
  )
}

export type { DashboardTopBarProps }
export default DashboardTopBar
