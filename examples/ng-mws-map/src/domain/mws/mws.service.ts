import {Injectable} from '@angular/core';
import {Observable, forkJoin, map} from 'rxjs';
import {RciService} from '@core/transport';
import {MwsMemberData, ShowMwsMemberActionService} from '@api/show-mws';
import {ShowVersionActionService, ShowVersionResponse} from '@api/show-version';
import {ShowIdentificationActionResponse, ShowIdentificationActionService} from '@api/show-identification';
import {MwsNode} from './mws.types';

@Injectable({
  providedIn: 'root',
})
export class MwsService {
  constructor(
    protected rciService: RciService,
    protected showVersion: ShowVersionActionService,
    protected showIdentification: ShowIdentificationActionService,
    protected showMwsMember: ShowMwsMemberActionService,
  ) {
  }

  public getMap(): Observable<MwsNode[]> {
    const obs$ = {
      showVersion: this.showVersion.execute(),
      showIdentification: this.showIdentification.execute(),
      showMwsMember: this.showMwsMember.execute(),
      bridge0Status: this.rciService.execute({path: 'show.interface', data: {name: 'Bridge0'}}),
    };

    return forkJoin(obs$)
      .pipe(
        map((data) => {
          const {showVersion, showIdentification, showMwsMember, bridge0Status} = data;

          return this.buildMap(showVersion, showIdentification, showMwsMember, bridge0Status);
        }),
      );
  }

  private buildMap(
    showVersion: ShowVersionResponse,
    showIdentification: ShowIdentificationActionResponse,
    showMwsMember: MwsMemberData[],
    bridge0Status: Record<string, any>,
  ): MwsNode[] {
    const nodeMap = new Map<string, MwsNode>();
    const controllerMac = bridge0Status['mac'];
    const rootNodes: MwsNode[] = [];

    // root node
    const controllerNode: MwsNode = {
      id: showIdentification.cid,
      name: showVersion.description,
      mac: controllerMac,
      isController: true,
      isOnline: true,
      model: '',
      parent: null,
      clients: [],
      children: [],
    };

    rootNodes.push(controllerNode);
    nodeMap.set(controllerMac, controllerNode);

    // create extender nodes
    for (const member of showMwsMember) {
      const memberMac = member.mac;

      const node: MwsNode = {
        id: member.cid,
        name: member['known-host'] || '',
        mac: memberMac,
        isController: false,
        isOnline: Boolean(member?.backhaul),
        model: member.model,
        parent: null,
        clients: [],
        children: [],
      };

      nodeMap.set(memberMac, node);
    }

    // for each extender: find 'connected via' node
    for (const member of showMwsMember) {
      const memberMac = member.mac;
      const node = nodeMap.get(memberMac);

      if (!node) {
        continue;
      }

      if (!member.backhaul) {
        rootNodes.push(node);

        continue;
      }

      const parentMac = (member.backhaul?.bridge ?? '').split('.')[1];
      const parentNode = nodeMap.get(parentMac);

      if (!parentNode) {
        rootNodes.push(node);

        continue;
      }

      const linkType = member?.backhaul?.ap ? 'wireless' : 'wired';

      // Create parent link
      node.parent = {
        type: linkType,
        node: parentNode,
      };

      // Add this node as a child of the parent
      parentNode.children.push({
        type: linkType,
        node,
      });
    }

    return rootNodes;
  }
}
