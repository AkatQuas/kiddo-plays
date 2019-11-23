import { createApp } from './app';

export default context => {
    return new Promise((resolve, reject) => {
        const { app, router } = createApp();

        // set server-side router location
        router.push(context.url)

        // wait until router has resolved possible async components and hook functions
        router.onReady(_ => {
            const matchedComponents = router.getMatchedComponents();
            if (!matchedComponents.length) {
                return reject({ code: 404 })
            }
            Promise.all(matchedComponents.map(Component => {
                if (Component.asyncData) {
                    return Component.asyncData({
                        store,
                        route: router.currentRoute
                    })
                }
            })).then(_ => {
                context.state = store.state;

                // the Promise should resolve to the app to be rendered
                resolve(app)
            }).catch(reject)
        }, reject)
    })
}