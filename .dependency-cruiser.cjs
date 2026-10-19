/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'platform-not-to-modules',
      severity: 'error',
      comment: 'Платформа не знает о бизнес-модулях.',
      from: { path: '^apps/api/src/platform/' },
      to: { path: '^apps/api/src/modules/' },
    },
    {
      name: 'modules-only-via-index',
      severity: 'error',
      comment: 'Модуль импортирует другой модуль только через его index.ts.',
      from: { path: '^apps/api/src/modules/([^/]+)/' },
      to: { path: '^apps/api/src/modules/(?!$1)([^/]+)/(?!index\\.ts)' },
    },
    {
      name: 'shared-not-features',
      severity: 'error',
      comment: 'shared не зависит от features и pages.',
      from: { path: '^apps/web/src/shared/' },
      to: { path: '^apps/web/src/(features|pages)/' },
    },
    {
      name: 'features-not-pages',
      severity: 'error',
      comment: 'Фича не знает о страницах.',
      from: { path: '^apps/web/src/features/' },
      to: { path: '^apps/web/src/pages/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules|dist|coverage' },
    exclude: { path: '(^|/)(dist|coverage)/' },
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
};
