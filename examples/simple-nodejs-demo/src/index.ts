import {catchError, exhaustMap, forkJoin, of, timeout, TimeoutError} from 'rxjs';
import inquirer from 'inquirer';
import {RciService} from './rci.service';

inquirer
  .prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter device IPv4 address:',
      default: '192.168.1.1',
      filter(input: any): string {
        return `http://${input}`;
      },
    },
    {
      type: 'input',
      name: 'username',
      message: 'Enter username:',
      default: 'admin',
    },
    {
      type: 'password',
      name: 'password',
      message: 'Enter password:',
    },
  ])
  .then((answers) => {
    const rciService = new RciService({
      address: answers.address,
      username: answers.username,
      password: answers.password,
    });

    rciService.ensureAuth()
      .pipe(
        timeout(3000),
        catchError((error) => {
          if (error instanceof TimeoutError) {
            console.log('Auth attempt timed out', error);

            return of(false);
          }

          console.log('Auth failed', error);

          return of(false);
        }),
        exhaustMap((isAuthenticated) => {
          if (!isAuthenticated) {
            console.warn(
              `Failed to authenticate with username="${answers.username}" and password="${answers.password}"`,
            );

            process.exit(0);
          }

          console.log('\n----------------------------------------------------------\n');
          console.log('\n\nBatching a few RCI queries\n\n');

          return forkJoin([
            rciService.execute({path: 'show.identification'}),
            rciService.execute({path: 'show.last-change'}),
            rciService.execute({path: 'system', data: {description: {no: true}}}),
          ]);
        }),
        exhaustMap((data) => {
          console.log('Responses for batched queries:', data);

          console.log('\n----------------------------------------------------------\n');
          console.log('\n\nQueuing "continued" commands\n\n');

          const pingTasks = [
            rciService.queueContinuedTask('tools.ping', {host: 'google.com', packetsize: 84, count: 5}),
            rciService.queueContinuedTask('tools.ping', {host: 'reddit.com', packetsize: 84, count: 5}),
          ];

          const componentsListTasks = [
            rciService.queueContinuedTask('components.list', {sandbox: 'stable'}),
            rciService.queueContinuedTask('components.list', {sandbox: 'draft'}),
          ];

          setTimeout(
            () => {
              console.log('\n[!] Manually aborting two "continued" tasks [!]\n');

              pingTasks[0]!.abort();
              componentsListTasks[1]!.abort();
            },
            500,
          );

          const done$ = [...pingTasks, ...componentsListTasks]
            .map((task) => task.done$);

          return forkJoin(done$);
        }),
      )
      .subscribe((done) => {
        console.log('Final data:', done);
      });
  })
  .catch((error) => {
    console.error('Uncaught error', error);

    process.exit(0);
  });
