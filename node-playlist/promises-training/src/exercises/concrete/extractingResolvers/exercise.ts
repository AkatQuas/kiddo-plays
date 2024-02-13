import { Router } from "../../../lib/concreteExercise/Router.js";
import { promiseWithResolvers } from "../../../lib/promiseWithResolvers.js";

type Context = {
  router: Router;
};

export default ({ router }: Context) =>
  async (url: string) => {
    const p = promiseWithResolvers();
    const onStart = () => {};
    const cleanup = () => {
      router.off("routeChangeComplete", onComplete);
      router.off("routeChangeError", onError);
    };
    const onComplete = () => {
      p.resolver();
      cleanup();
    };
    const onError = () => {
      p.rejecter("error");
      cleanup();
    };
    // router.on("routeChangeStart", () => {});
    router.on("routeChangeComplete", onComplete);
    router.on("routeChangeError", onError);

    router.push(url);

    return p.promise;
  };
