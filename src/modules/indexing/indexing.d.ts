declare global {
  // eslint-disable-next-line no-unused-vars
  namespace NodeJS {
    // eslint-disable-next-line no-unused-vars
    interface ProcessEnv {
      readonly INDEXING_TEST: string;
      readonly INDEXNOW_HOST: string;
      readonly INDEXNOW_KEY: string;
      readonly INDEXNOW_KEY_LOCATION: string;
    }
  }
}

export {};
