import { RouterProvider } from "react-router/dom";
import { Providers } from "@/spa/app/providers";
import { router } from "@/spa/app/router";

export default function SpaRoot() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}
