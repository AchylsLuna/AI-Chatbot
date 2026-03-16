type StatMetric = {
  key: string
  label: string
  value: number | string
  caption?: string
}

type StatStripProps = {
  metrics: StatMetric[]
}

const StatStrip = ({ metrics }: StatStripProps) => (
  <section className="reference-stat-strip">
    {metrics.map((metric, index) => (
      <article
        key={metric.key}
        className={`reference-stat-card ${index % 2 === 0 ? 'is-light' : 'is-dark'}`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="reference-stat-icon" aria-hidden="true" />
          <div className="text-right">
            <p className="reference-stat-label">{metric.label}</p>
            <p className="reference-stat-value">{metric.value}</p>
          </div>
        </div>
        {metric.caption ? <p className="reference-stat-caption">{metric.caption}</p> : null}
      </article>
    ))}
  </section>
)

export type { StatMetric, StatStripProps }
export default StatStrip
