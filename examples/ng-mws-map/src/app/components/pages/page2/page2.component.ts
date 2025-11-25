import {Component, ElementRef, afterNextRender, viewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import * as d3 from 'd3';

@Component({
  selector: 'nmm-page2',
  imports: [CommonModule],
  templateUrl: './page2.component.html',
  styleUrl: './page2.component.scss',
})
export class Page2Component {
  private readonly zoomContainer = viewChild<ElementRef<SVGSVGElement>>('zoomContainer');

  private readonly width = 800;
  private readonly height = 600;
  private readonly centerX = this.width / 2;
  private readonly centerY = this.height / 2;

  constructor() {
    afterNextRender(() => {
      const container = this.zoomContainer();

      if (container) {
        this.initZoom(container.nativeElement);
      }
    });
  }

  private initZoom(svgElement: SVGSVGElement): void {
    const svg = d3.select(svgElement);

    svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

    const g = svg.append('g');

    // circle representing this device
    g.append('circle')
      .attr('cx', this.centerX)
      .attr('cy', this.centerY)
      .attr('r', 20)
      .attr('fill', '#007bff')
      .attr('stroke', '#0056b3')
      .attr('stroke-width', 2);

    // circle label
    g.append('text')
      .attr('x', this.centerX)
      .attr('y', this.centerY + 40)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('fill', '#333')
      .text('Current Device');

    // zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on(
        'zoom',
        (event) => {
          g.attr('transform', event.transform.toString());
        },
      );

    svg.call(zoom);

    // initial transform -> center the view
    svg.call(zoom.transform, d3.zoomIdentity);
  }
}
