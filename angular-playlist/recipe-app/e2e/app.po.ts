import { browser, by, element } from 'protractor';

export class RecipeBookLearningPage {
  navigateTo() {
    return browser.get('/');
  }

  getParagraphText() {
    return element(by.css('rb-root h1')).getText();
  }
}
