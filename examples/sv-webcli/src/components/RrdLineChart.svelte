<script lang="ts">
import {untrack} from 'svelte';
import * as d3 from 'd3';
import {getYValueForX} from '../utils';
import type {RrdTick} from '../api';

export interface DataSeries {
  data: RrdTick[];
  color: string;
  label?: string;
}

let {
  series = [],
  width,
  height,
  timeDomain,

  barCount = 64,
  enableCursorTracking = false,
  showAxes = false,
  xAxisTickValues,
  paddingTop,
  paddingBottom,
  paddingLeft,
  paddingRight,
}: {
  series: DataSeries[];
  width: number;
  height: number;
  timeDomain: [Date, Date];

  barCount?: number;
  enableCursorTracking?: boolean;
  showAxes?: boolean;
  xAxisTickValues?: Date[];
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
} = $props();

const PADDING_TOP = $derived(paddingTop ?? (showAxes ? 30 : 2));
const PADDING_BOTTOM = $derived(paddingBottom ?? (showAxes ? 30 : 2));
const PADDING_LEFT = $derived(paddingLeft ?? (showAxes ? 50 : 2));
const PADDING_RIGHT = $derived(paddingRight ?? (showAxes ? 50 : 2));

let cursorX: number | null = $state(null);
let cursorValues: (number | null)[] = $state([]);

let containerRef: HTMLElement;
let svgRef: SVGSVGElement;

let yScale: d3.ScaleLinear<number, number> | null = $state(null);

const xAxisTickFormat = (d: Date, i: number): string => {
  if (i === 0 || i === 3) {
    return d3.timeFormat('%H:%M:%S')(d);
  }

  return '';
};

const drawChart = (): void => {
  if (!svgRef || series.length === 0) {
    return;
  }

  const svg = d3.select(svgRef);

  if (enableCursorTracking) {
    // clear chart paths, preserve cursor tracking elements (line and text)
    svg.selectAll('path.data-series').remove();

    if (showAxes) {
      svg.selectAll('g.axis').remove();
      svg.selectAll('text.max-value-label').remove();
    }
  } else {
    svg.selectAll('*').remove();
  }

  const validSeries = series.filter(s => s.data && s.data.length > 0);

  if (validSeries.length === 0) {
    return;
  }

  const allDisplayedData = validSeries.map(s => s.data.slice(-barCount));

  const yMaxValue = (() => {
    const allValues = allDisplayedData.flat().map(tick => tick.v);

    if (allValues.length === 0) {
      return 100;
    }

    const max = Math.max(...allValues);

    return Math.ceil(max * 1.1);
  })();

  let xScale: d3.ScaleTime<number, number>;
  let timeDataArray: Array<Array<{value: number; time: Date}>> | null = null;
  let tickValues: Date[] | null = null;

  // calculate X axis tick values (if not provided)
  if (!xAxisTickValues) {
    const ticks: Date[] = [];

    let curr = timeDomain[1];

    while (curr > timeDomain[0]) {
      ticks.push(new Date(curr));

      curr = new Date(curr.getTime() - 60 * 1000);
    }

    tickValues = ticks;
  } else {
    tickValues = xAxisTickValues;
  }

  xScale = d3.scaleTime()
    .domain(timeDomain)
    .range([PADDING_LEFT, width - PADDING_RIGHT]);

  // convert `RrdTick.t` values to `Date` objects
  timeDataArray = validSeries.map((seriesData) => {
    const displayedData = seriesData.data;

    if (displayedData.length === 0) {
      return [];
    }

    return displayedData.map((tick) => {
      const time = new Date(tick.t * 1000);

      return {value: tick.v, time};
    });
  });

  const currentYScale = d3.scaleLinear()
    .domain([0, yMaxValue])
    .range([height - PADDING_BOTTOM, PADDING_TOP]);

  // store scale for cursor tracking
  yScale = currentYScale;

  const line = d3.line<{value: number; time: Date}>()
    .x((d) => xScale(d.time))
    .y((d) => currentYScale(d.value))
    .curve(d3.curveMonotoneX);

  // draw axes
  if (showAxes) {
    const yAxis = d3.axisLeft(currentYScale).ticks(4);

    yAxis.tickFormat(formatValue as any);

    svg.append('g')
      .attr('transform', `translate(${PADDING_LEFT}, 0)`)
      .attr('class', 'axis')
      .call(yAxis);

    const xAxis = d3.axisBottom(xScale);

    xAxis.tickValues(tickValues);
    xAxis.tickFormat(xAxisTickFormat as any);

    svg.append('g')
      .attr('transform', `translate(0, ${height - PADDING_BOTTOM})`)
      .attr('class', 'axis')
      .call(xAxis);

    // max Y axis label
    svg.append('text')
      .attr('x', PADDING_RIGHT)
      .attr('y', PADDING_TOP - 5)
      .attr('text-anchor', 'end')
      .attr('class', 'max-value-label')
      .text(formatValue(yMaxValue));
  }

  // draw each series as a polyline
  validSeries.forEach((seriesData, index) => {
    const timeData = timeDataArray?.[index];

    if (!timeData) {
      return;
    }

    svg.append('path')
      .datum(timeData)
      .attr('class', 'data-series')
      .attr('fill', 'none')
      .attr('stroke', seriesData.color)
      .attr('stroke-width', showAxes ? 2 : 1.5)
      .attr('d', line);
  });
};

function formatValue(value: number): string {
  if (value === 0) {
    return '0';
  }

  const kbps = value / 1024;

  if (kbps < 1024) {
    return `${kbps.toFixed(1)} KB/s`;
  }

  const mbps = kbps / 1024;

  return `${mbps.toFixed(1)} MB/s`;
}

function handleMouseMove(event: MouseEvent) {
  if (!enableCursorTracking || !svgRef || !containerRef) {
    return;
  }

  if (!yScale) {
    return;
  }

  // store `yScale` in a local variable to avoid null check issues
  const currentYScale = yScale;
  const point = svgRef.createSVGPoint();

  point.x = event.clientX;
  point.y = event.clientY;

  const screenCTM = svgRef.getScreenCTM();

  if (!screenCTM) {
    return;
  }

  const svgPoint = point.matrixTransform(screenCTM.inverse());

  const x = svgPoint.x;
  const y = svgPoint.y;

  // check if mouse is within chart area
  if (
    x < PADDING_LEFT || x > width - PADDING_RIGHT
    || y < PADDING_TOP || y > height - PADDING_BOTTOM
  ) {
    cursorX = null;
    cursorValues = [];
    return;
  }

  cursorX = x;

  try {
    // for each series: find the corresponding path element and get Y value
    // only select data series paths, not axis paths
    const paths = svgRef.querySelectorAll('path.data-series');
    const values: (number | null)[] = [];

    paths.forEach((pathEl, idx) => {
      try {
        const pathY = getYValueForX(x, pathEl as SVGPathElement);

        values[idx] = currentYScale.invert(pathY);
      } catch {
        values[idx] = null;
      }
    });

    cursorValues = values;
  } catch (error) {
    cursorValues = [];
  }
}

function handleMouseLeave() {
  cursorX = null;
  cursorValues = [];
}

$effect(() => {
  // track dependencies that should trigger redraw
  series;
  width;
  height;
  barCount;
  showAxes;
  timeDomain;
  xAxisTickValues;

  drawChart();

  untrack(() => {
    const currentCursorX = cursorX;
    const currentYScale = yScale;

    if (!enableCursorTracking || currentCursorX === null || !currentYScale) {
      return;
    }

    const svg = svgRef;

    if (!svg) {
      return;
    }

    // only select data series paths, not axis paths
    const paths = svg.querySelectorAll('path.data-series');
    const values: (number | null)[] = [];

    paths.forEach((pathEl, idx) => {
      try {
        const pathY = getYValueForX(currentCursorX, pathEl as SVGPathElement);

        values[idx] = currentYScale.invert(pathY);
      } catch {
        values[idx] = null;
      }
    });

    cursorValues = values;
  });
});
</script>

<div
  role={enableCursorTracking ? 'presentation' : undefined}
  bind:this={containerRef}
  onmousemove={enableCursorTracking ? handleMouseMove : undefined}
  onmouseleave={enableCursorTracking ? handleMouseLeave : undefined}
  class:chart-container={enableCursorTracking}
  style="position: relative; display: inline-block; margin: 0; padding: 0;"
>
  <svg
    bind:this={svgRef}
    width={width}
    height={height}
    style="pointer-events: {enableCursorTracking ? 'auto' : 'none'};"
  >
    {#if enableCursorTracking && cursorX !== null}
      <!-- Vertical line at cursor -->
      <line
        x1={cursorX}
        y1={PADDING_TOP}
        x2={cursorX}
        y2={height - PADDING_BOTTOM}
        stroke="#666"
        stroke-width="1"
        stroke-dasharray="2,2"
        opacity="0.8"
        class="cursor-line"
      />

      <!-- Value label -->
      {#if cursorValues && cursorValues.length > 0}
        {#each cursorValues as value, idx}
          {#if value !== null}
            <text
              x={cursorX + 8}
              y={PADDING_TOP + idx * 14 - 10}
              text-anchor="start"
              class="cursor-value-label"
              font-size="10"
              fill={series[idx]?.color}
              style="font-weight: bold;"
            >
              {series[idx]?.label ? `${series[idx].label}: ` : ''}
              {formatValue(value)}
            </text>
          {/if}
        {/each}
      {/if}
    {/if}
  </svg>
</div>

<style>
svg {
  display: block;
}

:global(.axis) {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

:global(.axis path),
:global(.axis line) {
  fill: none;
  stroke: var(--color-border-medium);
  shape-rendering: crispEdges;
}

:global(.max-value-label) {
  font-size: var(--font-size-xs);
  font-weight: bold;
  fill: var(--color-text-secondary);
}

.cursor-line {
  pointer-events: none;
}

.cursor-value-label {
  pointer-events: none;
  fill: #333;
  font-weight: 600;
}

.chart-container {
  pointer-events: auto;
}
</style>
