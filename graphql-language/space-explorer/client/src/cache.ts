import { InMemoryCache, makeVar, Reference } from '@apollo/client';

export const cache: InMemoryCache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        isLoggedIn: {
          // Apollo Client calls read function
          // whenever the field is queried.
          read() {
            return isLoggedInVar();
          },
        },
        cartItems: {
          read() {
            return cartItemsVar();
          },
        },

        launches: {
          keyArgs: false,
          merge: (existing, incoming) => {
            // merge our two distinct lists of launches
            let launches: Reference[] = [];
            if (existing && existing.launches) {
              launches = launches.concat(existing.launches);
            }
            if (incoming && incoming.launches) {
              launches = launches.concat(incoming.launches);
            }

            return {
              ...incoming,
              launches,
            };
          },
        },
      },
    },
  },
});

/**
 *  Populate client-side schema fields with data from any source we want.
 *
 *  makeVar will return a function, from which reactive variables is generated
 */
// Initializes to true if localStorage includes a 'token' key,
// false otherwise
export const isLoggedInVar = makeVar<boolean>(!!localStorage.getItem('token'));

// Initializes to an empty array
export const cartItemsVar = makeVar<string[]>([]);
