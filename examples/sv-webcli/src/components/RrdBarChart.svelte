<script lang="ts">
import * as d3 from 'd3';

let {
  data,
  color,
  width = 60,
  height = 16,
  maxValue = 100,
  barCount = 64,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
  maxValue?: number;
  barCount?: number;
} = $props();

let svgRef: SVGSVGElement;

const PADDING_TOP = 2;
const PADDING_BOTTOM = 2;

const drawChart = (): void => {
  if (!svgRef || !data || data.length === 0) {
    return;
  }

  const displayedData = data.slice(-barCount);
  const svg = d3.select(svgRef);

  svg.selectAll('*').remove();

  if (displayedData.length === 0) {
    return;
  }

  const barWidth = width / displayedData.length;

  const yScale = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height - PADDING_BOTTOM, PADDING_TOP]); // invert Y-axis for SVG: 0 at bottom, max at top

  svg.selectAll('rect')
    .data(displayedData)
    .enter()
    .append('rect')
    .attr('x', (_, i) => i * barWidth)
    .attr('y', (d) => yScale(d))
    .attr('width', Math.max(0, barWidth * 0.8))
    .attr('height', (d) => Math.max(0, (height - PADDING_BOTTOM) - yScale(d)))
    .attr('fill', color);
};

// redraw chart whenever any reactive prop changes
$effect(() => {
  drawChart();
});
</script>

<svg bind:this={svgRef} width={width} height={height}></svg>

<style>
svg {
  display: block;
}
</style>
