export type Route =
  | { name: 'home' }
  | { name: 'import' }
  | { name: 'fix' }
  | { name: 'bank' }
  | { name: 'build' }
  | { name: 'test' }
  | { name: 'results'; moduleId: string }
  | { name: 'history' }
  | { name: 'words'; tab?: 'list' | 'cards' };

export type Go = (r: Route) => void;
