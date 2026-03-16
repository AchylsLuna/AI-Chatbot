import StatStrip from '../../../../components/layout/StatStrip'
import WidgetBlocks, {
  type ActivityItem,
  type FeaturedItem,
  type RecommendationItem,
} from '../../../../components/layout/WidgetBlocks'

type DoctorDashboardOverviewSectionProps = {
  metrics: {
    total: number
    booked: number
    recorded: number
    failed: number
  }
  completionRate: number
  weeklySeries: {
    booked: number[]
    recorded: number[]
    failed: number[]
  }
  activityItems: ActivityItem[]
  recommendationItems: RecommendationItem[]
  featuredItems: FeaturedItem[]
}

const DoctorDashboardOverviewSection = ({
  metrics,
  completionRate,
  weeklySeries,
  activityItems,
  recommendationItems,
  featuredItems,
}: DoctorDashboardOverviewSectionProps) => {
  return (
    <>
      <StatStrip
        metrics={[
          { key: 'total', label: 'Total', value: metrics.total },
          { key: 'booked', label: 'Booked', value: metrics.booked },
          { key: 'recorded', label: 'Recorded', value: metrics.recorded },
          { key: 'failed', label: 'Failed', value: metrics.failed },
        ]}
      />

      <WidgetBlocks
        summaryTitle="Queue completion"
        summaryValue={`${completionRate}%`}
        summaryLabel="Verified"
        secondaryLabel="Operations board"
        activityTitle="Recent activities"
        activityItems={activityItems}
        chartTitle="Vacancy stats"
        chartSeries={[
          { key: 'booked', label: 'Booked', color: '#3b82f6', values: weeklySeries.booked },
          { key: 'recorded', label: 'Recorded', color: '#10b981', values: weeklySeries.recorded },
          { key: 'failed', label: 'Failed', color: '#ef4444', values: weeklySeries.failed },
        ]}
        recommendationTitle="Recommended care operations"
        recommendationItems={recommendationItems}
        featuredTitle="Featured queues"
        featuredItems={featuredItems}
      />
    </>
  )
}

export default DoctorDashboardOverviewSection
