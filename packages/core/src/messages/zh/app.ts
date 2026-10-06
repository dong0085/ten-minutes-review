import type { en } from "../en";
import type { MessageShape } from "../type";

export const app: MessageShape<(typeof en)["App"]> = {
  Shell: {
    breadcrumb: "当前位置",
    back: "返回",
    closeQuiz: "关闭测验",
    errorTitle: "出了点问题",
    errorBlurb: "页面无法加载。请检查网络连接后重试。",
    retry: "重试",
    toClassrooms: "前往课堂",
  },
  Crumbs: {
    classrooms: "课堂",
    newClassroom: "新建课堂",
    notes: "笔记",
    addNotes: "添加笔记",
    bank: "题库",
    quizzes: "测验",
    settings: "设置",
    attempt: "结果",
    mistakes: "错题本",
    account: "账户",
    profile: "个人资料",
    security: "登录与安全",
    email: "邮件",
    plan: "方案与用量",
    referrals: "邀请好友",
    tokens: "API 令牌",
    data: "你的数据",
  },
  Hub: {
    addNotesBlurb:
      "刚上完新课？把笔记加在这里。新内容会和以前学过的知识一起参与后续复习。",
    inside: "课堂内容",
    notes: "笔记",
    notesMeta: "{count, plural, other {共添加 # 次}} · 最近添加：{when}",
    reading: "{count, plural, other {# 份正在整理}}",
    bank: "题库",
    bankMeta:
      "{count, plural, =0 {添加笔记后就会开始建题库} other {# 个知识点可参与出题}}",
    mistakes: "错题本",
    mistakesMeta:
      "{count, plural, =0 {近期没有需要回顾的错题} other {# 道近期错题，按需回顾}}",
    settings: "设置",
    settingsMeta: "名称、语言和每日复习",
  },
  QuizDetail: {
    take: "开始测验",
    retake: "重做",
    covers: "这次复习练什么",
    attempts: "作答记录",
    noAttempts: "你还没做过这份测验。提交后可查看答案和解析。",
  },
  AccountHub: {
    settings: "设置",
    profile: "个人资料",
    profileMeta: "名字、界面语言和时区",
    security: "登录与安全",
    securityMeta: "密码和已关联的账户",
    email: "邮件",
    emailMeta: "每日测验邮件",
    plan: "方案与用量",
    planMeta: "你的会员方案和本周用量",
    referrals: "邀请好友",
    referralsMeta: "邀请好友，双方各得一个月免费使用",
    tokens: "API 令牌",
    tokensMeta: "登录浏览器扩展",
    data: "你的数据",
    dataMeta: "导出全部数据，或删除账户",
  },
  FirefoxAddon: {
    action: "获取 Firefox 扩展",
    notesHint: "在网上读到有用的内容？Firefox 扩展可以把你选中的文字存为任意课堂里的笔记。",
    tokensHint:
      "Firefox 扩展可以把任意网页上选中的文字存为笔记。在扩展弹窗里用邮箱和密码登录，或粘贴在这里创建的令牌。",
  },
};
