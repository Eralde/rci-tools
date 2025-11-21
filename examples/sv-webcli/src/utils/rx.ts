import {onDestroy} from 'svelte';
import {Subject} from 'rxjs';

// Can be used similar to `DestroyRef` in Angular
export const useDestroy = (): Subject<void> => {
  const destroy$ = new Subject<void>();

  onDestroy(() => {
    destroy$.next();
    destroy$.complete();
  });

  return destroy$;
};
