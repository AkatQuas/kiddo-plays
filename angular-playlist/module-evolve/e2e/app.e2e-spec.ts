import { ModuleEvolvePage } from './app.po';

describe('module-evolve App', () => {
  let page: ModuleEvolvePage;

  beforeEach(() => {
    page = new ModuleEvolvePage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to app!');
  });
});
