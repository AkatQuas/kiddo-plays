import { graphqlFetch } from './utils/fetch.js';

const dice = 3;
const sides = 6;
const query = `query RollDice($dice: Int!, $sides: Int) {
  rollDice(numDice: $dice, numSides: $sides)
}`;

graphqlFetch({
  query,
  variables: { dice, sides },
});
