import type {IContentRenderer} from 'dockview-core';
import {mount, unmount} from 'svelte';
import Log from '../Log.svelte';

export class LogRenderer implements IContentRenderer {
  private readonly _element: HTMLElement;

  get element(): HTMLElement {
    return this._element;
  }

  private instance: ReturnType<typeof mount> | null = null;

  constructor() {
    this._element = document.createElement('div');
    this._element.style.height = '100%';
  }

  init(): void {
    this.instance = mount(
      Log,
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
