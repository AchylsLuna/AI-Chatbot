import { useMemo } from 'react'

type ActivityItem = {
  id: string
  title: string
  detail: string
  meta?: string
}

type ChartSeries = {
  key: string
  label: string
  color: string
  values: number[]
}

type RecommendationItem = {
  id: string
  title: string
  subtitle: string
  detail: string
  badge?: string
}

type FeaturedItem = {
  id: string
  title: string
  subtitle: string
}

type WidgetBlocksProps = {
  summaryTitle: string
  summaryValue: string
  summaryLabel: string
  secondaryLabel: string
  showSummaryPanel?: boolean
  activityTitle: string
  activityItems: ActivityItem[]
  chartTitle: string
  chartSeries: ChartSeries[]
  recommendationTitle: string
  recommendationItems: RecommendationItem[]
  featuredTitle: string
  featuredItems: FeaturedItem[]
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const buildPolyline = (values: number[], maxValue: number) => {
  if (!values.length) return ''
  const width = 100
  const height = 44
  const xStep = values.length > 1 ? width / (values.length - 1) : width

  return values
    .map((value, index) => {
      const x = index * xStep
      const y = height - (clamp(value, 0, maxValue) / maxValue) * height
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}

const WidgetBlocks = ({
  summaryTitle,
  summaryValue,
  summaryLabel,
  secondaryLabel,
  showSummaryPanel = true,
  activityTitle,
  activityItems,
  chartTitle,
  chartSeries,
  recommendationTitle,
  recommendationItems,
  featuredTitle,
  featuredItems,
}: WidgetBlocksProps) => {
  const ringPercent = useMemo(() => {
    const parsed = Number.parseInt(summaryValue.replace(/[^\d]/g, ''), 10)
    if (Number.isNaN(parsed)) return 70
    return clamp(parsed, 0, 100)
  }, [summaryValue])

  const maxSeriesValue = useMemo(() => {
    const values = chartSeries.flatMap((series) => series.values)
    const highest = Math.max(...values, 1)
    return highest
  }, [chartSeries])

  return (
    <div className="space-y-4">
      <div className="reference-dashboard-grid">
        <article className="reference-card reference-summary-card">
          {showSummaryPanel ? (
            <div className="reference-progress-wrap">
              <div
                className="reference-progress-ring"
                style={{
                  background: `conic-gradient(var(--reference-blue-500) ${ringPercent}%, var(--reference-border) ${ringPercent}% 100%)`,
                }}
                aria-hidden="true"
              >
                <div className="reference-progress-inner">
                  <span>{summaryValue}</span>
                </div>
              </div>
              <p className="reference-widget-title">{summaryTitle}</p>
              <p className="reference-widget-subtle">{summaryLabel}</p>
              <p className="reference-widget-subtle">{secondaryLabel}</p>
            </div>
          ) : null}

          <div className="reference-activity-block">
            <h3 className="reference-section-title">{activityTitle}</h3>
            <ul className="reference-activity-list">
              {activityItems.map((item) => (
                <li key={item.id} className="reference-activity-item">
                  <span className="reference-activity-icon" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="reference-activity-title">{item.title}</span>
                    <span className="reference-activity-detail">{item.detail}</span>
                    {item.meta ? <span className="reference-activity-meta">{item.meta}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className="reference-card reference-chart-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="reference-section-title">{chartTitle}</h3>
            <div className="reference-legend-list">
              {chartSeries.map((series) => (
                <span key={series.key} className="reference-legend-item">
                  <span className="reference-legend-dot" style={{ backgroundColor: series.color }} />
                  {series.label}
                </span>
              ))}
            </div>
          </div>

          <div className="reference-chart-surface" role="img" aria-label={chartTitle}>
            <svg viewBox="0 0 100 44" className="h-full w-full" preserveAspectRatio="none">
              {Array.from({ length: 6 }).map((_, index) => {
                const y = (index * 44) / 5
                return (
                  <line
                    key={`grid-${index}`}
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke="var(--reference-grid)"
                    strokeWidth="0.4"
                  />
                )
              })}

              {chartSeries.map((series) => (
                <polyline
                  key={series.key}
                  points={buildPolyline(series.values, maxSeriesValue)}
                  fill="none"
                  stroke={series.color}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        </article>
      </div>

      <article className="reference-card">
        <h3 className="reference-section-title">{recommendationTitle}</h3>
        <div className="reference-horizontal-list">
          {recommendationItems.map((item) => (
            <div key={item.id} className="reference-rec-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="reference-rec-title">{item.title}</p>
                  <p className="reference-rec-subtitle">{item.subtitle}</p>
                </div>
                <span className="reference-rec-icon" aria-hidden="true" />
              </div>
              <p className="reference-rec-detail">{item.detail}</p>
              {item.badge ? <span className="reference-rec-badge">{item.badge}</span> : null}
            </div>
          ))}
        </div>
      </article>

      <article className="reference-card">
        <h3 className="reference-section-title">{featuredTitle}</h3>
        <div className="reference-featured-grid">
          {featuredItems.map((item) => (
            <div key={item.id} className="reference-featured-card">
              <span className="reference-featured-icon" aria-hidden="true" />
              <div className="min-w-0">
                <p className="reference-featured-title">{item.title}</p>
                <p className="reference-featured-subtitle">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </article>
    </div>
  )
}

export type {
  ActivityItem,
  FeaturedItem,
  RecommendationItem,
  ChartSeries,
  WidgetBlocksProps,
}

export default WidgetBlocks
