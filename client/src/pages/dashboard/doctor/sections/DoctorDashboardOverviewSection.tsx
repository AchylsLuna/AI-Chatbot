import DashboardStatStrip from '../../../../components/layout/DashboardStatStrip'
import DashboardWidgetBlocks, {
  type DashboardActivityItem,
  type DashboardFeaturedItem,
  type DashboardRecommendationItem,
} from '../../../../components/layout/DashboardWidgetBlocks'

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
  activityItems: DashboardActivityItem[]
  recommendationItems: DashboardRecommendationItem[]
  featuredItems: DashboardFeaturedItem[]
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
      <DashboardStatStrip
        metrics={[
          { key: 'total', label: 'Total', value: metrics.total },
          { key: 'booked', label: 'Booked', value: metrics.booked },
          { key: 'recorded', label: 'Recorded', value: metrics.recorded },
          { key: 'failed', label: 'Failed', value: metrics.failed },
        ]}
      />

      <DashboardWidgetBlocks
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
