module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm dlx serve@14.2.5 out -l 4173',
      startServerReadyPattern: 'Accepting connections',
      startServerReadyTimeout: 30000,
      url: [
        'http://localhost:4173/',
        'http://localhost:4173/pt-br/',
      ],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.95 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
