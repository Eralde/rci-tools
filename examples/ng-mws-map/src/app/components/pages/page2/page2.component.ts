import {Component, ElementRef, afterNextRender, viewChild} from '@angular/core';
import {CommonModule} from '@angular/common';
import * as d3 from 'd3';
import {coordGreedy, decrossOpt, graphStratify, layeringLongestPath, sugiyama} from 'd3-dag';
import {exhaustMap, timer} from 'rxjs';
import {MwsService} from '@domain/mws/mws.service';
import {MwsNode} from '@domain/mws/mws.types';

interface DagNode {
  id: string;
  data: MwsNode;
  children: DagNode[];
  links: Array<{child: DagNode; type: 'wired' | 'wireless'}>;
}

interface PositionedNode {
  node: DagNode;
  x: number;
  y: number;
  dagIndex: number;
}

interface Edge {
  source: PositionedNode;
  target: PositionedNode;
  type: 'wired' | 'wireless';
}

@Component({
  selector: 'nmm-page2',
  imports: [CommonModule],
  templateUrl: './page2.component.html',
  styleUrl: './page2.component.scss',
})
export class Page2Component {
  private readonly zoomContainer = viewChild<ElementRef<SVGSVGElement>>('zoomContainer');

  private readonly width = 1200;
  private readonly height = 800;
  private readonly nodeWidth = 120;
  private readonly nodeHeight = 60;
  private readonly nodePadding = 20;
  private readonly dagSpacing = 200;

  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;
  private g: d3.Selection<SVGGElement, unknown, null, undefined> | null = null;

  constructor(
    protected mwsService: MwsService,
  ) {
    afterNextRender(() => {
      const container = this.zoomContainer();

      if (container) {
        this.initZoom(container.nativeElement);
      }

      timer(1000)
        .pipe(
          exhaustMap(() => {
            return this.mwsService.getMap();
          }),
        )
        .subscribe((map) => {
          this.renderMap(map);
        });
    });
  }

  private initZoom(svgElement: SVGSVGElement): void {
    this.svg = d3.select(svgElement);
    this.svg.attr('viewBox', `0 0 ${this.width} ${this.height}`);

    this.g = this.svg.append('g');

    // zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on(
        'zoom',
        (event) => {
          if (this.g) {
            this.g.attr('transform', event.transform.toString());
          }
        },
      );

    this.svg.call(zoom);

    // initial transform -> center the view
    this.svg.call(zoom.transform, d3.zoomIdentity);
  }

  private convertToDag(rootNode: MwsNode, nodeMap: Map<string, DagNode>): DagNode {
    let dagNode = nodeMap.get(rootNode.mac);

    if (dagNode) {
      return dagNode;
    }

    dagNode = {
      id: rootNode.mac,
      data: rootNode,
      children: [],
      links: [],
    };

    nodeMap.set(rootNode.mac, dagNode);

    // Add children - cast to MwsNode since children always contain MwsNode instances
    for (const childLink of rootNode.children) {
      const childMwsNode = childLink.node as MwsNode;
      const childDagNode = this.convertToDag(childMwsNode, nodeMap);
      dagNode.children.push(childDagNode);
      dagNode.links.push({
        child: childDagNode,
        type: childLink.type,
      });
    }

    return dagNode;
  }

  private convertToStratifyData(rootNode: DagNode): Array<{id: string; parentIds: string[]; data: MwsNode}> {
    const result: Array<{id: string; parentIds: string[]; data: MwsNode}> = [];
    const visited = new Set<string>();

    const traverse = (node: DagNode, parentId: string | null): void => {
      if (visited.has(node.id)) {
        return;
      }

      visited.add(node.id);

      result.push({
        id: node.id,
        parentIds: parentId ? [parentId] : [],
        data: node.data,
      });

      for (const link of node.links) {
        traverse(link.child, node.id);
      }
    };

    traverse(rootNode, null);
    return result;
  }

  private getLinkType(parentId: string, childId: string, dagRoot: DagNode): 'wired' | 'wireless' {
    const findLinkType = (node: DagNode): 'wired' | 'wireless' | null => {
      for (const link of node.links) {
        if (link.child.id === childId) {
          return link.type;
        }
        const result = findLinkType(link.child);
        if (result) {
          return result;
        }
      }
      return null;
    };

    return findLinkType(dagRoot) || 'wired';
  }

  private countDagNodes(rootNode: DagNode): number {
    const visited = new Set<string>();
    let count = 0;

    const traverse = (node: DagNode): void => {
      if (visited.has(node.id)) {
        return;
      }

      visited.add(node.id);
      count++;

      for (const link of node.links) {
        traverse(link.child);
      }
    };

    traverse(rootNode);
    return count;
  }

  private renderMap(rootNodes: MwsNode[]): void {
    if (!this.g) {
      return;
    }

    // Clear previous content
    this.g.selectAll('*').remove();

    if (rootNodes.length === 0) {
      return;
    }

    const nodeMap = new Map<string, DagNode>();
    const dagRoots = rootNodes.map((root) => this.convertToDag(root, nodeMap));

    // Find the longest DAG (by node count)
    const dagSizes = dagRoots.map((root, index) => ({
      index,
      root,
      size: this.countDagNodes(root),
    }));

    const longestDagIndex =
      dagSizes.reduce((max, current) => (current.size > max.size ? current : max), dagSizes[0]).index;

    // Reorder DAGs so the longest one is in the center
    const reorderedDagRoots: DagNode[] = [];
    const reorderedIndices: number[] = [];

    // Add DAGs before the longest one
    for (let i = 0; i < longestDagIndex; i++) {
      reorderedDagRoots.push(dagRoots[i]);
      reorderedIndices.push(i);
    }

    // Add the longest DAG in the center
    reorderedDagRoots.push(dagRoots[longestDagIndex]);
    reorderedIndices.push(longestDagIndex);

    // Add DAGs after the longest one
    for (let i = longestDagIndex + 1; i < dagRoots.length; i++) {
      reorderedDagRoots.push(dagRoots[i]);
      reorderedIndices.push(i);
    }

    // Layout each DAG using sugiyama
    const layouts = reorderedDagRoots.map((root) => {
      const stratifyData = this.convertToStratifyData(root);
      const stratifyFn = graphStratify();
      const dag = stratifyFn(stratifyData);

      const layout = sugiyama()
        .layering(layeringLongestPath())
        .decross(decrossOpt())
        .coord(coordGreedy())
        .nodeSize([this.nodeWidth + this.nodePadding, this.nodeHeight + this.nodePadding])
        .gap([this.nodePadding, this.nodePadding]);

      return {dag, layout: layout(dag)};
    });

    // Calculate positions for multiple DAGs, centering the longest one
    const positionedNodes: PositionedNode[] = [];
    const edges: Edge[] = [];

    // First pass: calculate widths of all DAGs
    const dagWidths: number[] = [];
    layouts.forEach(({dag}) => {
      let minX = Infinity;
      let maxX = -Infinity;

      for (const node of dag.nodes()) {
        const x = node.x ?? 0;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }

      const width = maxX - minX + this.nodeWidth + this.nodePadding;
      dagWidths.push(width);
    });

    // Calculate total width of DAGs before the longest one
    const longestDagPosition = Math.floor(reorderedDagRoots.length / 2);
    let totalWidthBeforeLongest = 0;

    for (let i = 0; i < longestDagPosition; i++) {
      totalWidthBeforeLongest += dagWidths[i] + this.dagSpacing;
    }

    // Start position: center of view minus half of longest DAG width minus width before longest
    const centerX = this.width / 2;
    const longestDagWidth = dagWidths[longestDagPosition];
    let currentX = centerX - longestDagWidth / 2 - totalWidthBeforeLongest;

    layouts.forEach(({dag, layout}, dagIndex) => {
      const originalDagIndex = reorderedIndices[dagIndex];
      const dagRoot = reorderedDagRoots[dagIndex];
      const nodePositions = new Map<string, PositionedNode>();

      // Collect all node positions from layout
      for (const node of dag.nodes()) {
        const nodeData = node.data as {id: string; data: MwsNode};
        const dagNode = nodeMap.get(nodeData.id);

        if (dagNode) {
          const x = currentX + (node.x ?? 0);
          const y = 50 + (node.y ?? 0);
          const positionedNode: PositionedNode = {node: dagNode, x, y, dagIndex: originalDagIndex};
          nodePositions.set(dagNode.id, positionedNode);
          positionedNodes.push(positionedNode);
        }
      }

      // Collect edges from layout links
      for (const link of dag.links()) {
        const sourceData = link.source.data as {id: string; data: MwsNode};
        const targetData = link.target.data as {id: string; data: MwsNode};
        const sourceNode = nodePositions.get(sourceData.id);
        const targetNode = nodePositions.get(targetData.id);
        const linkType = this.getLinkType(sourceData.id, targetData.id, dagRoot);

        if (sourceNode && targetNode) {
          edges.push({
            source: sourceNode,
            target: targetNode,
            type: linkType,
          });
        }
      }

      // Move to next DAG position
      currentX += dagWidths[dagIndex] + this.dagSpacing;
    });

    // Draw edges with S-shaped curves
    const edgeGroup = this.g.append('g').attr('class', 'edges');

    // Create line generator for S-shaped curves
    const lineGenerator = d3.line<{x: number; y: number}>()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(d3.curveBasis);

    edgeGroup
      .selectAll('path')
      .data(edges)
      .enter()
      .append('path')
      .attr('d', (d) => {
        const x1 = this.getClosestSideX(d.source, d.target, true);
        const y1 = this.getClosestSideY(d.source, d.target, true);
        const x2 = this.getClosestSideX(d.source, d.target, false);
        const y2 = this.getClosestSideY(d.source, d.target, false);

        // Calculate control points for S-shaped curve
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const controlOffset = Math.min(distance * 0.4, 100); // Control point offset

        // Determine control point directions based on connection sides
        let cp1x: number, cp1y: number, cp2x: number, cp2y: number;

        const sourceSide = this.getConnectionSide(d.source, d.target, true);
        const targetSide = this.getConnectionSide(d.source, d.target, false);

        // Control point 1: offset from source in the direction perpendicular to the connection side
        if (sourceSide === 'left' || sourceSide === 'right') {
          cp1x = x1 + (sourceSide === 'left' ? -controlOffset : controlOffset);
          cp1y = y1;
        } else {
          cp1x = x1;
          cp1y = y1 + (sourceSide === 'top' ? -controlOffset : controlOffset);
        }

        // Control point 2: offset from target in the direction perpendicular to the connection side
        if (targetSide === 'left' || targetSide === 'right') {
          cp2x = x2 + (targetSide === 'left' ? -controlOffset : controlOffset);
          cp2y = y2;
        } else {
          cp2x = x2;
          cp2y = y2 + (targetSide === 'top' ? -controlOffset : controlOffset);
        }

        return lineGenerator([
          {x: x1, y: y1},
          {x: cp1x, y: cp1y},
          {x: cp2x, y: cp2y},
          {x: x2, y: y2},
        ]);
      })
      .attr('fill', 'none')
      .attr('stroke', '#666')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', (d) => (d.type === 'wireless' ? '5,5' : '0'));

    // Draw nodes
    const nodeGroup = this.g.append('g').attr('class', 'nodes');
    const nodeElements = nodeGroup
      .selectAll('g.node')
      .data(positionedNodes)
      .enter()
      .append('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x},${d.y})`);

    // Draw rectangles
    nodeElements
      .append('rect')
      .attr('width', this.nodeWidth)
      .attr('height', this.nodeHeight)
      .attr('x', -this.nodeWidth / 2)
      .attr('y', -this.nodeHeight / 2)
      .attr('rx', 4)
      .attr('fill', (d) => (d.node.data.isController ? '#007bff' : '#ffffff'))
      .attr('stroke', (d) => (d.node.data.isOnline ? '#28a745' : '#dc3545'))
      .attr('stroke-width', 2);

    // Draw node name/model text
    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', (d) => (d.node.data.isController ? 'bold' : 'normal'))
      .attr('fill', '#333')
      .attr('y', -8)
      .text((d) => d.node.data.name || d.node.data.id);

    nodeElements
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('y', 8)
      .text((d) => d.node.data.model || '');

    // Fit view to content
    if (this.svg && positionedNodes.length > 0) {
      const bounds = this.g.node()?.getBBox();

      if (bounds) {
        const padding = 50;
        const viewBoxWidth = Math.max(this.width, bounds.width + padding * 2);
        const viewBoxHeight = Math.max(this.height, bounds.height + padding * 2);
        this.svg.attr('viewBox', `0 0 ${viewBoxWidth} ${viewBoxHeight}`);
      }
    }
  }

  private getClosestSideX(source: PositionedNode, target: PositionedNode, isSource: boolean): number {
    const node = isSource ? source : target;
    const other = isSource ? target : source;
    const halfWidth = this.nodeWidth / 2;

    // Calculate which side is closest
    const dx = Math.abs(other.x - node.x);
    const dy = Math.abs(other.y - node.y);

    if (dx > dy) {
      // Horizontal connection
      if (other.x < node.x) {
        return node.x - halfWidth;
      } else {
        return node.x + halfWidth;
      }
    } else {
      // Vertical connection - use center X
      return node.x;
    }
  }

  private getClosestSideY(source: PositionedNode, target: PositionedNode, isSource: boolean): number {
    const node = isSource ? source : target;
    const other = isSource ? target : source;
    const halfHeight = this.nodeHeight / 2;

    // Calculate which side is closest
    const dx = Math.abs(other.x - node.x);
    const dy = Math.abs(other.y - node.y);

    if (dy > dx) {
      // Vertical connection
      if (other.y < node.y) {
        return node.y - halfHeight;
      } else {
        return node.y + halfHeight;
      }
    } else {
      // Horizontal connection - use center Y
      return node.y;
    }
  }

  private getConnectionSide(
    source: PositionedNode,
    target: PositionedNode,
    isSource: boolean,
  ): 'left' | 'right' | 'top' | 'bottom' {
    const node = isSource ? source : target;
    const other = isSource ? target : source;
    const halfWidth = this.nodeWidth / 2;
    const halfHeight = this.nodeHeight / 2;

    const dx = Math.abs(other.x - node.x);
    const dy = Math.abs(other.y - node.y);

    if (dx > dy) {
      // Horizontal connection
      if (other.x < node.x) {
        return 'left';
      } else {
        return 'right';
      }
    } else {
      // Vertical connection
      if (other.y < node.y) {
        return 'top';
      } else {
        return 'bottom';
      }
    }
  }
}
