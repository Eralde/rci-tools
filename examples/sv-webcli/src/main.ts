import {mount} from 'svelte';
import './global.css';
import './router';
import App from './App.svelte';

mount(App, {target: document.querySelector('#app')!});
