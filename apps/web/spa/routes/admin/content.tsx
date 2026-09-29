import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@tmr/ui/components/badge";
import { Button } from "@tmr/ui/components/button";
import { EXTRACTION_STATUS_LABELS, JOB_STATUS_LABELS, fmt, useAdminAction, useAdminQuery } from "@/spa/lib/admin";
import {
  AdminPage,
  ConfirmButton,
  DataTable,
  FilterTabs,
  JsonBlock,
  KeyValues,
  LoadError,
  Loading,
  Pager,
  Panel,
  StatusBadge,
  UserLink,
} from "@/spa/components/admin/ui";

function PrivacyNote() {
  return (
    <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      只读视图。每次打开都会记到操作日志里。
    </p>
  );
}

// ---------- Classroom ----------

type ClassroomDetail = {
  classroom: {
    id: string;
    userId: string;
    name: string;
    targetLanguage: string;
    nativeLanguage: string;
    autoStopDays: number;
    quizLength: number;
    activeUntil: string;
    pausedAt: string | null;
    archivedAt: string | null;
    includeAnswersInEmail: boolean;
    createdAt: string;
  };
  uploads: {
    id: string;
    kind: string;
    originalFilename: string | null;
    subject: string | null;
    extractionStatus: string;
    extractionError: string | null;
    createdAt: string;
    pointCount: number;
  }[];
  knowledgePoints: { id: string; category: string; targetText: string; nativeText: string | null; retiredAt: string | null }[];
  quizzes: { id: string; quizDate: string; kind: string; size: number; promptVersion: string; composedAt: string; attemptCount: number }[];
  attempts: { id: string; quizId: string; correctCount: number; questionCount: number; durationMs: number; submittedAt: string }[];
  tutorRequests: { id: string; mode: string; level: number; status: string; createdAt: string }[];
};

type Tab = "uploads" | "points" | "quizzes" | "attempts" | "tutor";

export function AdminClassroomPage() {
  const { userId, classroomId } = useParams();
  const [tab, setTab] = useState<Tab>("uploads");
  const { data, error, isPending } = useAdminQuery<ClassroomDetail>(`/classrooms/${classroomId}`);
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const { classroom } = data;
  return (
    <AdminPage
      title={classroom.name}
      description={`${classroom.targetLanguage} ← ${classroom.nativeLanguage} · 创建于 ${fmt.date(classroom.createdAt)}`}
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link to={`/admin/users/${userId}`}>
            <ArrowLeft className="size-4" /> 返回用户
          </Link>
        </Button>
      }
    >
      <PrivacyNote />
      <Panel>
        <KeyValues
          items={[
            ["每日测验至", fmt.dateTime(classroom.activeUntil)],
            ["暂停", classroom.pausedAt ? fmt.dateTime(classroom.pausedAt) : "否"],
            ["归档", classroom.archivedAt ? fmt.dateTime(classroom.archivedAt) : "否"],
            ["自动停止天数", classroom.autoStopDays],
            ["测验长度", classroom.quizLength || "自动"],
            ["邮件附答案", classroom.includeAnswersInEmail ? "是" : "否"],
          ]}
        />
      </Panel>
      <FilterTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "uploads", label: `笔记 ${data.uploads.length}` },
          { value: "points", label: `知识点 ${data.knowledgePoints.length}` },
          { value: "quizzes", label: `测验 ${data.quizzes.length}` },
          { value: "attempts", label: `答题 ${data.attempts.length}` },
          { value: "tutor", label: `AI 导师 ${data.tutorRequests.length}` },
        ]}
      />
      <Panel flush>
        {tab === "uploads" ? (
          <DataTable
            rows={data.uploads}
            rowKey={(row) => row.id}
            columns={[
              {
                header: "笔记",
                cell: (row) => (
                  <Link to={`/admin/uploads/${row.id}`} className="text-primary hover:underline">
                    {row.subject ?? row.originalFilename ?? (row.kind === "text" ? "文字笔记" : "图片")}
                  </Link>
                ),
              },
              { header: "类型", cell: (row) => row.kind },
              {
                header: "提取",
                cell: (row) => (
                  <StatusBadge status={row.extractionStatus} label={EXTRACTION_STATUS_LABELS[row.extractionStatus]} />
                ),
              },
              { header: "知识点", cell: (row) => row.pointCount, className: "text-right tabular-nums" },
              { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
            ]}
          />
        ) : tab === "points" ? (
          <DataTable
            rows={data.knowledgePoints}
            rowKey={(row) => row.id}
            columns={[
              { header: "类别", cell: (row) => <Badge variant="outline">{row.category}</Badge> },
              { header: "内容", cell: (row) => <span className={row.retiredAt ? "line-through opacity-60" : ""}>{row.targetText}</span> },
              { header: "释义", cell: (row) => row.nativeText ?? "—" },
            ]}
          />
        ) : tab === "quizzes" ? (
          <DataTable
            rows={data.quizzes}
            rowKey={(row) => row.id}
            columns={[
              {
                header: "日期",
                cell: (row) => (
                  <Link to={`/admin/quizzes/${row.id}`} className="text-primary hover:underline">
                    {row.quizDate}
                  </Link>
                ),
              },
              { header: "类型", cell: (row) => row.kind },
              { header: "题数", cell: (row) => row.size, className: "text-right tabular-nums" },
              { header: "作答", cell: (row) => row.attemptCount, className: "text-right tabular-nums" },
              { header: "Prompt", cell: (row) => <code className="text-xs">{row.promptVersion}</code> },
              { header: "生成时间", cell: (row) => fmt.dateTime(row.composedAt) },
            ]}
          />
        ) : tab === "attempts" ? (
          <DataTable
            rows={data.attempts}
            rowKey={(row) => row.id}
            columns={[
              { header: "提交时间", cell: (row) => fmt.dateTime(row.submittedAt) },
              {
                header: "得分",
                cell: (row) => `${row.correctCount} / ${row.questionCount}`,
                className: "tabular-nums",
              },
              { header: "用时", cell: (row) => fmt.ms(row.durationMs) },
              {
                header: "测验",
                cell: (row) => (
                  <Link to={`/admin/quizzes/${row.quizId}`} className="text-primary hover:underline">
                    查看
                  </Link>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={data.tutorRequests}
            rowKey={(row) => row.id}
            columns={[
              { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
              { header: "模式", cell: (row) => (row.mode === "hint" ? `提示 ${row.level}` : "错因分析") },
              { header: "状态", cell: (row) => <StatusBadge status={row.status} /> },
            ]}
          />
        )}
      </Panel>
    </AdminPage>
  );
}

// ---------- Quiz ----------

type QuizDetail = {
  quiz: Record<string, unknown> & { classroomName: string; user_id: string; classroom_id: string; quiz_date: string; kind: string; prompt_version: string };
  questions: {
    id: string;
    position: number;
    category: string;
    type: string;
    stem: string;
    options: string[] | null;
    answer: unknown;
    explanation: string;
  }[];
};

function answerText(question: QuizDetail["questions"][number]) {
  const answer = question.answer as { index?: number; blanks?: string[]; value?: boolean };
  if (typeof answer.index === "number") {
    return question.options?.[answer.index] ?? String(answer.index);
  }
  if (answer.blanks) {
    return answer.blanks.join(" / ");
  }
  if (typeof answer.value === "boolean") {
    return answer.value ? "对" : "错";
  }
  return JSON.stringify(answer);
}

export function AdminQuizPage() {
  const { quizId } = useParams();
  const { data, error, isPending } = useAdminQuery<QuizDetail>(`/quizzes/${quizId}`);
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const { quiz } = data;
  return (
    <AdminPage
      title={`${quiz.classroomName} · ${quiz.quiz_date}`}
      description={`${quiz.kind} · ${data.questions.length} 题 · prompt ${quiz.prompt_version}`}
      actions={
        <Button asChild size="sm" variant="ghost">
          <Link to={`/admin/users/${quiz.user_id}/classrooms/${quiz.classroom_id}`}>
            <ArrowLeft className="size-4" /> 返回课堂
          </Link>
        </Button>
      }
    >
      <PrivacyNote />
      <ol className="space-y-3">
        {data.questions.map((question) => (
          <li key={question.id} className="rounded-2xl border border-border/70 bg-card/75 p-4 text-sm">
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">#{question.position + 1}</span>
              <Badge variant="outline">{question.category}</Badge>
              <Badge variant="outline">{question.type}</Badge>
            </div>
            <p className="whitespace-pre-wrap">{question.stem}</p>
            {question.options ? (
              <ul className="mt-2 list-inside list-[upper-alpha] space-y-0.5 text-muted-foreground">
                {question.options.map((option, index) => (
                  <li key={index}>{option}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2">
              <span className="text-muted-foreground">答案：</span>
              <span className="font-medium text-success">{answerText(question)}</span>
            </p>
            <p className="mt-1 text-muted-foreground">{question.explanation}</p>
          </li>
        ))}
      </ol>
    </AdminPage>
  );
}

// ---------- Uploads ----------

type UploadRow = {
  id: string;
  kind: string;
  originalFilename: string | null;
  subject: string | null;
  byteSize: number | null;
  extractionStatus: string;
  extractionError: string | null;
  createdAt: string;
  classroomId: string;
  classroomName: string;
  userId: string;
  email: string;
  pointCount: number;
};

const UPLOAD_LIMIT = 50;

export function AdminUploadsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const offset = Number(params.get("offset") ?? 0);
  const query = new URLSearchParams({ status, offset: String(offset), limit: String(UPLOAD_LIMIT) });
  const { data, error, isPending } = useAdminQuery<{ rows: UploadRow[] }>(`/uploads?${query}`);
  const set = (next: Record<string, string>) => setParams({ status, offset: "0", ...next }, { replace: true });

  return (
    <AdminPage title="笔记上传" description="所有用户最近上传的笔记和提取结果。">
      <FilterTabs
        value={status}
        onChange={(value) => set({ status: value })}
        options={[
          { value: "", label: "全部" },
          { value: "failed", label: "失败" },
          { value: "pending", label: "等待中" },
          { value: "running", label: "提取中" },
          { value: "done", label: "完成" },
        ]}
      />
      <Panel flush>
        {isPending ? (
          <Loading />
        ) : error || !data ? (
          <div className="p-4">
            <LoadError error={error} />
          </div>
        ) : (
          <>
            <DataTable
              rows={data.rows}
              rowKey={(row) => row.id}
              columns={[
                {
                  header: "笔记",
                  cell: (row) => (
                    <Link to={`/admin/uploads/${row.id}`} className="text-primary hover:underline">
                      {row.subject ?? row.originalFilename ?? (row.kind === "text" ? "文字笔记" : "图片")}
                    </Link>
                  ),
                },
                { header: "用户", cell: (row) => <UserLink id={row.userId} email={row.email} /> },
                { header: "课堂", cell: (row) => row.classroomName },
                {
                  header: "提取",
                  cell: (row) => (
                    <span title={row.extractionError ?? undefined}>
                      <StatusBadge status={row.extractionStatus} label={EXTRACTION_STATUS_LABELS[row.extractionStatus]} />
                    </span>
                  ),
                },
                { header: "知识点", cell: (row) => row.pointCount, className: "text-right tabular-nums" },
                { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
              ]}
            />
            <Pager offset={offset} limit={UPLOAD_LIMIT} count={data.rows.length} onChange={(next) => set({ offset: String(next) })} />
          </>
        )}
      </Panel>
    </AdminPage>
  );
}

type UploadDetail = {
  upload: Record<string, unknown> & {
    id: string;
    kind: string;
    text_content: string | null;
    original_filename: string | null;
    mime_type: string | null;
    byte_size: number | null;
    extraction_status: string;
    extraction_error: string | null;
    subject: string | null;
    discarded: unknown[];
    created_at: string;
    extracted_at: string | null;
    classroomName: string;
    classroom_id: string;
    userId: string;
    email: string;
  };
  knowledgePoints: { id: string; category: string; targetText: string; nativeText: string | null; inferred: boolean; sourceExcerpt: string | null; promptVersion: string }[];
  passages: { id: string; targetText: string; nativeText: string | null }[];
  jobs: { id: string; status: string; attempts: number; lastError: string | null; createdAt: string }[];
  imageUrl: string | null;
};

export function AdminUploadPage() {
  const { uploadId } = useParams();
  const { data, error, isPending } = useAdminQuery<UploadDetail>(`/uploads/${uploadId}`);
  const reextract = useAdminAction<Record<string, never>>(`/uploads/${uploadId}`);
  if (isPending) {
    return <Loading />;
  }
  if (error || !data) {
    return <LoadError error={error} />;
  }
  const { upload } = data;
  return (
    <AdminPage
      title={upload.subject ?? upload.original_filename ?? "笔记"}
      description={
        <>
          <UserLink id={upload.userId} email={upload.email} /> ·{" "}
          <Link className="text-primary hover:underline" to={`/admin/users/${upload.userId}/classrooms/${upload.classroom_id}`}>
            {upload.classroomName}
          </Link>
        </>
      }
      actions={
        upload.extraction_status !== "done" ? (
          <ConfirmButton
            label="重新提取"
            title="重新提取这份笔记？"
            description="会新建一个提取任务，并产生一次 LLM 调用。"
            onConfirm={() => reextract.mutate({})}
          />
        ) : null
      }
    >
      <PrivacyNote />
      {upload.extraction_error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {upload.extraction_error}
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="原始内容">
          <KeyValues
            items={[
              ["类型", upload.kind],
              ["状态", <StatusBadge key="status" status={upload.extraction_status} label={EXTRACTION_STATUS_LABELS[upload.extraction_status]} />],
              ["上传时间", fmt.dateTime(upload.created_at)],
              ["提取完成", fmt.dateTime(upload.extracted_at)],
              ...(upload.byte_size ? ([["大小", fmt.bytes(upload.byte_size)]] as [string, string][]) : []),
            ]}
          />
          <div className="mt-4">
            {upload.kind === "text" ? (
              <JsonBlock value={upload.text_content ?? ""} />
            ) : data.imageUrl ? (
              <a href={data.imageUrl} target="_blank" rel="noreferrer">
                <img src={data.imageUrl} alt={upload.original_filename ?? "笔记图片"} className="max-h-[32rem] rounded-xl border border-border/60" />
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">图片不可用</p>
            )}
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="提取任务" flush>
            <DataTable
              rows={data.jobs}
              rowKey={(row) => row.id}
              empty="没有任务（可能是在 web 端直接提取的）"
              columns={[
                {
                  header: "任务",
                  cell: (row) => (
                    <Link to={`/admin/jobs/${row.id}`} className="text-primary hover:underline">
                      {row.id.slice(0, 8)}
                    </Link>
                  ),
                },
                { header: "状态", cell: (row) => <StatusBadge status={row.status} label={JOB_STATUS_LABELS[row.status]} /> },
                { header: "尝试", cell: (row) => row.attempts },
                { header: "时间", cell: (row) => fmt.dateTime(row.createdAt) },
              ]}
            />
          </Panel>
          <Panel title={`丢弃的内容（${upload.discarded?.length ?? 0}）`}>
            {upload.discarded?.length ? <JsonBlock value={upload.discarded} /> : <p className="text-sm text-muted-foreground">没有</p>}
          </Panel>
        </div>
      </div>
      <Panel title={`提取出的知识点（${data.knowledgePoints.length}）`} flush>
        <DataTable
          rows={data.knowledgePoints}
          rowKey={(row) => row.id}
          columns={[
            { header: "类别", cell: (row) => <Badge variant="outline">{row.category}</Badge> },
            { header: "内容", cell: (row) => row.targetText },
            { header: "释义", cell: (row) => row.nativeText ?? "—" },
            { header: "推断", cell: (row) => (row.inferred ? "是" : "") },
            { header: "原文", cell: (row) => <span className="text-xs text-muted-foreground">{row.sourceExcerpt ?? ""}</span> },
          ]}
        />
      </Panel>
      {data.passages.length > 0 ? (
        <Panel title={`阅读段落（${data.passages.length}）`}>
          <div className="space-y-3 text-sm">
            {data.passages.map((passage) => (
              <p key={passage.id} className="whitespace-pre-wrap">
                {passage.targetText}
              </p>
            ))}
          </div>
        </Panel>
      ) : null}
    </AdminPage>
  );
}
