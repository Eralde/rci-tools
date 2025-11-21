import type {IContentRenderer} from 'dockview-core';
import {mount, unmount} from 'svelte';
import RestApi from '../RestApi.svelte';

export class RestApiRenderer implements IContentRenderer {
  private readonly _element: HTMLElement;

  get element(): HTMLElement {
    return this._element;
  }

  private instance: ReturnType<typeof mount> | null = null;

  constructor() {
    this._element = document.createElement('div');
    this._element.style.height = '100%';
    this._element.style.display = 'flex';
    this._element.style.flexDirection = 'column';
  }

  init(): void {
    this.instance = mount(
      RestApi,
      {
        target: this._element,
      },
    );
  }

  dispose() {
    if (this.instance) {
      void unmount(this.instance);
    }
  }
}
