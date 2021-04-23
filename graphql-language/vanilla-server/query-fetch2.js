import { graphqlFetch } from './utils/fetch.js';

const numRolls = 3;
const numSides = 6;
const query = `query ($numSides: Int, $numRolls: Int!) {
  getDie(numSides: $numSides) {
    rollOnce
    roll(numRolls: $numRolls)
  }
}
`;

graphqlFetch({
  query,
  variables: { numSides, numRolls },
});
