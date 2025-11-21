<script lang="ts">
import RrdLineChart from './RrdLineChart.svelte';
import type {DataSeries} from './RrdLineChart.svelte';

interface Props {
  series: DataSeries[];
  barCount: number;
  timeDomain: [Date, Date];
  width?: number;
  height?: number;
}

let {
  series,
  barCount,
  timeDomain,
  width = 400,
  height = 200,
}: Props = $props();
</script>

<div class="chart-popover">
  <RrdLineChart
    {series}
    {width}
    {height}
    {barCount}
    enableCursorTracking={true}
    showAxes={true}
    timeDomain={timeDomain}
  />
</div>

<style>
.chart-popover {
  background-color: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--space-xs);
  box-shadow: 0 0.25rem 0.5rem rgba(0, 0, 0, 0.2);
  padding: var(--space-sm);
}
</style>
