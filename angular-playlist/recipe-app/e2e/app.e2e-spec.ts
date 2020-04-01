import { RecipeBookLearningPage } from './app.po';

describe('recipe-book-learning App', () => {
  let page: RecipeBookLearningPage;

  beforeEach(() => {
    page = new RecipeBookLearningPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getParagraphText()).toEqual('Welcome to rb!');
  });
});
