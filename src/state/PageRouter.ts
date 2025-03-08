import IndexPage from "../pages/IndexPage.tsx";
import StateStore from "./state.ts";

export const Router = {
  index: IndexPage,
};

type PageRouter = { currentPage: keyof typeof Router };

const PageRouterStore = new StateStore<PageRouter>({ currentPage: "index" });
await PageRouterStore.initialize();

export default PageRouterStore;
