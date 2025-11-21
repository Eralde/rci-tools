import type {GroupPanelPartInitParameters, IContentRenderer} from 'dockview-core';
import {mount, unmount} from 'svelte';
import type {TerminalInstance} from '../../services/cli.service.ts';
import TerminalWrapper from '../TerminalWrapper.svelte';

export class TerminalWrapperRenderer implements IContentRenderer {
  private readonly _element: HTMLElement;

  get element(): HTMLElement {
    return this._element;
  }

  private componentInstance: ReturnType<typeof mount> | null = null;
  private terminalInstance: TerminalInstance | null = null;
  private resizeDisposable: {dispose: () => void} | null = null;

  constructor() {
    this._element = document.createElement('div');
    this._element.style.width = '100%';
    this._element.style.height = '100%';
  }

  init(parameters: GroupPanelPartInitParameters): void {
    this.componentInstance = mount(
      TerminalWrapper,
      {
        target: this._element,
        props: {
          onTerminalReady: (instance: TerminalInstance) => {
            this.terminalInstance = instance;

            // Listen to panel resize events
            this.resizeDisposable = parameters.api.onDidDimensionsChange(() => {
              if (this.terminalInstance) {
                this.terminalInstance.fitAddon.fit();
              }
            });
          },
        },
      },
    );
  }

  dispose() {
    if (this.resizeDisposable) {
      this.resizeDisposable.dispose();
    }

    if (this.terminalInstance) {
      this.terminalInstance.dispose();
    }

    if (this.componentInstance) {
      void unmount(this.componentInstance);
    }
  }
}
