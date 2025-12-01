import {Routes} from '@angular/router';
import {LoginComponent} from './components/login/login.component';
import {LayoutComponent} from './components/layout/layout.component';
import {Page1Component} from './components/pages/page1/page1.component';
import {Page2Component} from './components/pages/page2/page2.component';
import {Page3Component} from './components/pages/page3/page3.component';
import {AuthGuard} from './core/guards';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'main',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    providers: [
      AuthGuard,
    ],
    children: [
      {
        path: '',
        redirectTo: 'page1',
        pathMatch: 'full',
      },
      {
        path: 'page1',
        component: Page1Component,
      },
      {
        path: 'page2',
        component: Page2Component,
      },
      {
        path: 'page3',
        component: Page3Component,
      },
    ],
  },
];
