<script lang="ts">
import {rciService} from '../api/rci.service.ts';
import {LOGIN_URL, MAIN_URL, navigate} from '../router.ts';

rciService.isAuthenticated()
  .subscribe((isAuthenticated) => {
    if (isAuthenticated) {
      navigate(MAIN_URL);
    } else {
      navigate(LOGIN_URL);
    }
  });
</script>

<div id="content">
  <p>Redirecting...</p>
</div>

<style>
#content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
