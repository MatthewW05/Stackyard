import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: {
    eslintrc: {
      enabled: 9,
    },
  },
  manifest: {
    name: 'Stackyard',
    description: 'Preview any public GitHub repo running live, right from its repo page.',
  },
});
