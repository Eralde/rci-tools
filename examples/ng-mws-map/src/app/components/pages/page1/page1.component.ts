import {Component, signal} from '@angular/core';
import {RciService} from '../../../core/transport/rci.service';
import {JsonPipe} from '@angular/common';

@Component({
  selector: 'nmm-page1',
  imports: [
    JsonPipe,
  ],
  templateUrl: './page1.component.html',
  styleUrl: './page1.component.scss',
})
export class Page1Component {
  public readonly showVersion = signal<unknown>(null);

  constructor(private rciService: RciService) {
    this.rciService.queue({path: 'show.version'})
      .subscribe((data) => this.showVersion.set(data));
  }
}
