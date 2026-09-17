import { vi } from "vitest";

export const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};
export const navigationState = { pathname: "/preview/demo/dashboard" };

/** Call inside vi.mock("next/navigation", ...) factories. */
export function nextNavigationMock() {
  return {
    useRouter: () => routerMock,
    usePathname: () => navigationState.pathname,
    useSearchParams: () => new URLSearchParams(),
    notFound: vi.fn(),
    redirect: vi.fn(),
  };
}
