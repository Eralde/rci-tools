import {GroupPanelPartInitParameters, ITabRenderer} from 'dockview-core';

export class PersistentTabRenderer implements ITabRenderer {
  private readonly _element: HTMLElement;
  private readonly _content: HTMLElement;
  private _title: string | undefined;

  get element(): HTMLElement {
    return this._element;
  }

  constructor() {
    this._element = document.createElement('div');
    this._element.className = 'dv-default-tab';

    this._content = document.createElement('div');
    this._content.className = 'dv-default-tab-content';

    this._element.appendChild(this._content);

    this.render();
  }

  init(params: GroupPanelPartInitParameters): void {
    this._title = params.title;

    this.render();
  }

  private render(): void {
    if (this._content.textContent !== this._title) {
      this._content.textContent = this._title ?? '';
    }
  }
}
