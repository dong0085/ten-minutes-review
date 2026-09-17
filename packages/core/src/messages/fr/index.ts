import type { en } from "../en";
import type { MessageShape } from "../type";
import { account } from "./account";
import { api } from "./api";
import { auth } from "./auth";
import { email } from "./email";
import { category } from "./category";
import { classroom } from "./classroom";
import { common } from "./common";
import { home } from "./home";
import { layout } from "./layout";
import { quiz } from "./quiz";
import { seo } from "./seo";
import { upload } from "./upload";

export const fr: MessageShape<typeof en> = {
  Common: common,
  Layout: layout,
  Home: home,
  Seo: seo,
  Auth: auth,
  Account: account,
  Classroom: classroom,
  Quiz: quiz,
  Category: category,
  Upload: upload,
  Email: email,
  Api: api,
};
