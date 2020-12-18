const { GraphQLScalarType } = require('graphql');
const debug = require('debug')('gql:resolver');
const { paginateResults } = require('./utils');

module.exports = {
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value); // value from the client
    },
    /**
     * @param {Date} value
     */
    serialize(value) {
      return value.toISOString(); // value sent to the client
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return parseInt(ast.value, 10); // ast value is always in string format
      }
      return null;
    },
  }),
  Query: {
    author: async (_, { name, ...rest }) => {
      return {
        name,
        big: 'nothing big',
      };
    },
    authorWithBook: async (_, { name, ...rest }) => {
      console.log('awb-> ', name, rest);
      return {
        author: { name },
      };
    },

    launches: async (_, { pageSize = 6, after }, { dataSources }) => {
      const allLaunches = await dataSources.launchAPI.getAllLaunches();
      // in reverse chronological order
      allLaunches.reverse();
      const launches = paginateResults({
        after,
        pageSize,
        results: allLaunches,
      });
      return {
        launches,
        cursor: launches.length ? launches[launches.length - 1].cursor : null,
        hasMore: launches.length
          ? launches[launches.length - 1].cursor !==
            allLaunches[allLaunches.length - 1].cursor
          : false,
      };
    },
    launchesList: (_, __, { dataSources }) =>
      dataSources.launchAPI.getAllLaunches(),
    launch: (_, { id }, { dataSources }) =>
      dataSources.launchAPI.getLaunchById({ launchId: id }),
    me: (_, __, { dataSources }) => dataSources.userAPI.findOrCreateUser(),
  },
  Author: {
    name: (parent, args) => {
      console.log('Author-> ', parent, args);
      return 'Author📝:' + parent.name;
    },
  },
  AuthorWithBook: {
    author: (parent, args) => {
      console.log('awk/author', parent, args);
      return {
        name: parent.author.name + ' is a hacked author',
      };
    },

    // nested query args should be got
    books: (parent, args) => {
      console.log('awk/books->', args);
      const { query } = args;
      let size = query.limit;
      const result = [];
      while (size > 0) {
        result.push({
          name: 'book📚' + size,
          publish: new Date(),
        });
        size -= 1;
      }
      return result;
    },
  },
  /* This has the same level as Query */
  Book: {
    name: (parent, args) => {
      console.log('Book-> ', parent, args);
      return 'bookname📒:' + parent.name;
    },
  },

  /* This has the same level as Query */
  Mission: {
    missionPatch: (mission, { size } = { size: 'LARGE' }) => {
      return size === 'SMALL'
        ? mission.missionPatchSmall
        : mission.missionPatchLarge;
    },
  },

  /* This has the same level as Query */
  Launch: {
    isBooked: async (launch, _, { dataSources }) => {
      return dataSources.userAPI.isBookedOnLaunch({
        launchId: launch.id,
      });
    },
  },

  /* This has the same level as Query */
  User: {
    trips: async (_, __, { dataSources }) => {
      const launchIds = await dataSources.userAPI.getLaunchIdsByUser();
      if (launchIds.length === 0) {
        return [];
      }

      return (
        dataSources.launchAPI.getLaunchesByIds({
          launchIds,
        }) || []
      );
    },
  },

  /* This has the same level as Query */
  Mutation: {
    login: async (_, { email }, { dataSources }) => {
      const user = await dataSources.userAPI.findOrCreateUser({ email });
      if (user) {
        user.token = Buffer.from(email).toString('base64');
        return user;
      }
    },

    bookTrips: async (_, { launchIds }, { dataSources }) => {
      const results = await dataSources.userAPI.bookTrips({ launchIds });
      const launches = await dataSources.launchAPI.getLaunchesByIds({
        launchIds,
      });
      return {
        launches,
        success: results && results.length === launchIds.length,
        message:
          results.length === launchIds.length
            ? 'trips booked successfully'
            : `the following launches couldn't be booked: ${launchIds.filter(
                (id) => !results.includes(id)
              )}`,
      };
    },
    cancelTrip: async (_, { launchId }, { dataSources }) => {
      const result = await dataSources.userAPI.cancelTrip({ launchId });
      if (!result) {
        return {
          success: false,
          message: 'failed to cancel trip',
        };
      }
      const launch = await dataSources.launchAPI.getLaunchById({ launchId });
      return {
        success: true,
        message: 'trip cancelled',
        launches: [launch],
      };
    },
  },
};
