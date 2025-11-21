import {createRouter} from 'sv-router';
import {catchError, firstValueFrom} from 'rxjs';
import {rciService} from './api/rci.service.ts';
import {deviceService} from './services';
import {About, Login, Main, NotFound} from './routes';
import Layout from './layouts/Layout.svelte';
import {shared} from './state/shared.svelte.ts';

export const LOGIN_URL = '/login';
export const MAIN_URL = '/main';

// Redirect to /login on an auth error
rciService.authError$
  .subscribe(() => {
    navigate(LOGIN_URL);
  });

const beforeLoadHook = async (): Promise<void> => {
  const obs$ = deviceService.getDeviceProfile()
    .pipe(
      catchError((err) => {
        console.log(
          `Error on trying to get the device profile. Redirecting to "${LOGIN_URL}"`,
          err,
        );

        throw navigate(LOGIN_URL);
      }),
    );

  const profile = await firstValueFrom(obs$);

  shared.vendor = profile?.vendor ?? null;
  shared.device = profile?.device ?? null;
};

export const {p, navigate} = createRouter({
  [MAIN_URL]: {
    '/': Main,
    '/about': About,
    layout: Layout,
    hooks: {
      beforeLoad: beforeLoadHook,
    },
  },
  [LOGIN_URL]: Login,
  '*': NotFound,
});
