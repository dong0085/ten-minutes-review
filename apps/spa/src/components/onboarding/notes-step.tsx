import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { useTranslations } from "use-intl";
import { ArrowLeft, ArrowRight, Camera, FileText, ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import { DEMO_PAPERS, MAX_IMAGE_BYTES, type LanguageCode } from "@tmr/core";
import { Alert, AlertDescription } from "@tmr/ui/components/alert";
import { Button } from "@tmr/ui/components/button";
import { Textarea } from "@tmr/ui/components/textarea";
import { cn } from "@tmr/ui/utils";
import { api } from "@/lib/api";
import { markOnboarded } from "@/lib/onboarding";
import { keys } from "@/lib/queries";
import { readError } from "@/lib/read-error";
import { useRouter } from "@/lib/router";
import { sessionKey, useSession } from "@/lib/session";

/** A guest may add one photo; an account can add as many as the notes screen allows. */
const MAX_PHOTOS = 10;
/** After this long the screen says the user can leave while the notes are read. */
const SLOW_MS = 25_000;
const POLL_MS = 2500;
const POINTS_SHOWN = 8;

type Mode = "photo" | "text";
type Phase = "form" | "saving" | "reading" | "done" | "failed" | "composing";
type Photo = { file: File; url: string };
type UploadRow = { id: string; extractionStatus: "pending" | "running" | "done" | "failed"; extractionError: string | null };
type Point = { id: string; targetText: string; nativeText: string | null };
type ComposeJob = { status: "pending" | "running" | "done" | "failed" | "cancelled"; quizId: string | null };

const POINTS: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
};

const POINT: Variants = {
  hidden: { opacity: 0, y: 12, scale: 0.9, rotate: -2 },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    rotate: 0,
    transition: { type: "spring", stiffness: 420, damping: 24 },
  },
};

/** The notes being read, with a highlighter band sweeping down them until they are done. */
function NotesUnderReview({ photos, text, reading }: { photos: Photo[]; text: string; reading: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/75 bg-card shadow-[0_18px_40px_-18px_rgb(var(--shadow-colour)/0.28)]">
      {photos.length > 0 ? (
        <div className={cn("grid gap-1 p-1", photos.length > 1 && "grid-cols-2 sm:grid-cols-3")}>
          {photos.map((photo) => (
            <img
              key={photo.url}
              src={photo.url}
              alt=""
              className={cn(
                "w-full rounded-xl object-cover",
                photos.length > 1 ? "aspect-square" : "max-h-72",
              )}
            />
          ))}
        </div>
      ) : (
        <p className="paper-lines max-h-72 overflow-hidden px-5 py-1 font-heading text-[0.95rem] leading-8 whitespace-pre-wrap [mask-image:linear-gradient(to_bottom,black_75%,transparent)]">
          {text}
        </p>
      )}
      <AnimatePresence>
        {reading ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/20 to-transparent"
            initial={{ top: "-20%", opacity: 0 }}
            animate={{ top: ["-20%", "100%"], opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              top: { duration: 2.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 0.25 },
              opacity: { duration: 0.3 },
            }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const WRITTEN_LINES = ["w-2/3", "w-5/6", "w-1/2", "w-3/4", "w-2/5"];

/** A blank paper whose lines are written in one after another while the quiz is composed. */
function PaperBeingWritten() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: 1.5 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="quiz-paper-stack mx-auto w-full max-w-sm"
    >
      <div className="quiz-paper px-7 pt-7 pb-8">
        <div className="mx-auto h-2 w-1/3 rounded-full bg-foreground/20" />
        <div className="mt-6 space-y-5">
          {WRITTEN_LINES.map((width, index) => (
            <div key={width + index} className="flex items-center gap-3">
              <span className="size-3.5 shrink-0 rounded-full border border-foreground/30" />
              <motion.span
                className={cn("h-1.5 origin-left rounded-full bg-primary/35", width)}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: [0, 1, 1, 0] }}
                transition={{
                  duration: 3.2,
                  times: [0, 0.3, 0.85, 1],
                  ease: "easeInOut",
                  repeat: Infinity,
                  delay: index * 0.35,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

export function NotesStep({
  targetLanguage,
  nativeLanguage,
  languageName,
  signedIn,
  onBack,
}: {
  targetLanguage: LanguageCode;
  nativeLanguage: string;
  languageName: string;
  signedIn: boolean;
  onBack: () => void;
}) {
  const t = useTranslations("Onboarding.Notes");
  const tCommon = useTranslations("Common");
  const tTour = useTranslations("Onboarding.Tour");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const [mode, setMode] = useState<Mode>("photo");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [text, setText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("form");
  const [classroomId, setClassroomId] = useState<string | null>(null);
  const [uploadIds, setUploadIds] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [slow, setSlow] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [composeError, setComposeError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef(photos);
  const maxPhotos = signedIn ? MAX_PHOTOS : 1;

  // Object URLs for the previews live as long as the screen does.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);
  useEffect(() => () => photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url)), []);

  // Poll until every upload is read, then pull the points it added.
  useEffect(() => {
    if (phase !== "reading" || !classroomId) {
      return;
    }
    let stopped = false;
    const check = async () => {
      const data = await api
        .get<{ uploads: UploadRow[] }>(`/api/classrooms/${classroomId}/uploads`)
        .catch(() => null);
      if (stopped || !data) {
        return;
      }
      const mine = data.uploads.filter((upload) => uploadIds.includes(upload.id));
      if (mine.length === 0 || mine.some((upload) => upload.extractionStatus === "pending" || upload.extractionStatus === "running")) {
        return;
      }
      if (mine.every((upload) => upload.extractionStatus === "failed")) {
        setFailure(mine[0]?.extractionError ?? null);
        setPhase("failed");
        return;
      }
      const bank = await api
        .get<{ knowledgePoints: Point[] }>(`/api/classrooms/${classroomId}/knowledge-points`)
        .catch(() => null);
      if (stopped) {
        return;
      }
      setPoints(bank?.knowledgePoints ?? []);
      setPhase("done");
      void queryClient.invalidateQueries({ queryKey: keys.classrooms });
    };
    const interval = setInterval(() => void check(), POLL_MS);
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
      clearTimeout(slowTimer);
    };
  }, [phase, classroomId, uploadIds, queryClient]);

  useEffect(() => {
    if (phase !== "composing" || !classroomId || !jobId) {
      return;
    }
    const interval = setInterval(() => {
      void api
        .get<ComposeJob>(`/api/classrooms/${classroomId}/quizzes/jobs/${jobId}`)
        .then((job) => {
          if (job.status === "done" && job.quizId) {
            clearInterval(interval);
            void queryClient.invalidateQueries({ queryKey: keys.classrooms });
            router.push(`/classrooms/${classroomId}/quizzes/${job.quizId}/take`);
          } else if (job.status === "failed" || job.status === "cancelled" || job.status === "done") {
            clearInterval(interval);
            setComposeError(true);
            setPhase("done");
          }
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [phase, classroomId, jobId, queryClient, router]);

  // The quiz is written from here, so a guest gets one too; the classroom hub only offers it to accounts.
  const makeQuiz = async () => {
    setComposeError(false);
    setPhase("composing");
    try {
      const created = await api.post<{ jobId: string | null }>(`/api/classrooms/${classroomId}/quizzes`);
      if (!created.jobId) {
        throw new Error("No compose job");
      }
      setJobId(created.jobId);
    } catch {
      setComposeError(true);
      setPhase("done");
    }
  };

  const addFiles = (selected: File[]) => {
    setError(null);
    const next = [...photos];
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES || next.length >= maxPhotos) {
        break;
      }
      next.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos(next);
  };

  const removePhoto = (url: string) => {
    URL.revokeObjectURL(url);
    setPhotos((current) => current.filter((photo) => photo.url !== url));
  };

  const onDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragActive(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (mode === "text" ? !trimmed : photos.length === 0) {
      setError(t("emptyForm"));
      return;
    }
    setError(null);
    setPhase("saving");
    try {
      let id = classroomId;
      if (!id) {
        const created = await api.post<{ classroom: { id: string } }>("/api/classrooms", {
          name: t("classroomName", { language: languageName }),
          targetLanguage,
          nativeLanguage,
        });
        id = created.classroom.id;
        setClassroomId(id);
        await markOnboarded(session, queryClient);
        // A visitor has just become a guest; the header and banners follow the new session.
        void queryClient.invalidateQueries({ queryKey: sessionKey });
        void queryClient.invalidateQueries({ queryKey: keys.classrooms });
      }
      let response: Response;
      if (mode === "text") {
        response = await fetch(`/api/classrooms/${id}/uploads`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed }),
        });
      } else {
        const formData = new FormData();
        for (const photo of photos) {
          formData.append("files", photo.file);
        }
        response = await fetch(`/api/classrooms/${id}/uploads`, { method: "POST", body: formData });
      }
      if (!response.ok) {
        throw new Error((await readError(response)) ?? tCommon("genericError"));
      }
      const data = (await response.json()) as { uploadIds: string[] };
      setUploadIds(data.uploadIds);
      setSlow(false);
      setPhase("reading");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : tCommon("genericError"));
      setPhase("form");
    }
  };

  if (phase === "reading" || phase === "done" || phase === "failed" || phase === "composing") {
    const reading = phase === "reading";
    const composing = phase === "composing";
    return (
      <div className="mx-auto w-full max-w-xl pb-12" aria-live="polite">
        <div className="text-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={phase}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            >
              <p className="eyebrow">{t("kicker")}</p>
              <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                {reading
                  ? t("readingTitle")
                  : composing
                    ? t("composingTitle")
                    : phase === "failed"
                      ? t("failedTitle")
                      : t("doneTitle", { count: points.length })}
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {reading
                  ? t("readingBlurb")
                  : composing
                    ? t("composingBlurb")
                    : phase === "failed"
                      ? (failure ?? tCommon("genericError"))
                      : points.length > 0
                        ? t("doneBlurb")
                        : t("emptyBlurb")}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8">
          {composing ? (
            <PaperBeingWritten />
          ) : (
            <NotesUnderReview photos={photos} text={text.trim()} reading={reading} />
          )}
        </div>

        {composeError ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{t("composeFailed")}</AlertDescription>
          </Alert>
        ) : null}

        {phase === "done" && points.length > 0 ? (
          <motion.ul
            variants={POINTS}
            initial="hidden"
            animate="shown"
            className="mt-6 flex flex-wrap justify-center gap-2"
          >
            {points.slice(0, POINTS_SHOWN).map((point) => (
              <motion.li
                key={point.id}
                variants={POINT}
                className="rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-1.5 text-sm shadow-sm"
              >
                <span lang={targetLanguage} className="font-heading font-semibold">
                  {point.targetText}
                </span>
                {point.nativeText ? (
                  <span className="ml-1.5 text-muted-foreground">{point.nativeText}</span>
                ) : null}
              </motion.li>
            ))}
            {points.length > POINTS_SHOWN ? (
              <motion.li variants={POINT} className="px-2 py-1.5 text-sm text-muted-foreground">
                +{points.length - POINTS_SHOWN}
              </motion.li>
            ) : null}
          </motion.ul>
        ) : null}

        <AnimatePresence>
          {reading && slow ? (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-5 text-center text-sm text-muted-foreground"
            >
              {t("slowHint")}
            </motion.p>
          ) : null}
        </AnimatePresence>

        <div className="mt-8 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
          {classroomId && !composing && (!reading || slow) ? (
            <Button asChild variant="outline" size="lg">
              <a
                href={`/classrooms/${classroomId}`}
                onClick={(event) => {
                  event.preventDefault();
                  router.push(`/classrooms/${classroomId}`);
                }}
              >
                {t("openClassroom")}
              </a>
            </Button>
          ) : null}
          {phase === "failed" && signedIn ? (
            <Button size="lg" onClick={() => setPhase("form")}>
              {t("tryAgain")}
            </Button>
          ) : null}
          {phase === "done" && points.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 22, delay: 0.5 }}
            >
              <Button
                size="lg"
                className="group"
                onClick={() => void makeQuiz()}
              >
                <Sparkles />
                {t("makeQuiz")}
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Button>
            </motion.div>
          ) : null}
        </div>

        {!signedIn && !reading && !composing ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 260, damping: 26 }}
            className="mt-10 flex flex-col items-start justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 sm:flex-row sm:items-center sm:px-5"
          >
            <div>
              <p className="text-sm font-semibold">{t("guestTitle")}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("guestBlurb")}</p>
            </div>
            <Button asChild size="sm" className="shrink-0">
              <a href="/signup">
                {t("guestAction")}
                <ArrowRight className="size-3.5" />
              </a>
            </Button>
          </motion.div>
        ) : null}
      </div>
    );
  }

  const saving = phase === "saving";

  return (
    <form className="mx-auto w-full max-w-xl pb-12" onSubmit={submit}>
      <div className="text-center">
        <p className="eyebrow">{t("kicker")}</p>
        <h1 className="mt-3 font-heading text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{t("blurb")}</p>
      </div>

      <div className="mx-auto mt-8 flex w-fit rounded-xl border border-border/75 bg-muted/40 p-1" role="tablist">
        {(["photo", "text"] as const).map((entry) => (
          <button
            key={entry}
            type="button"
            role="tab"
            aria-selected={mode === entry}
            onClick={() => {
              setMode(entry);
              setError(null);
            }}
            className={cn(
              "relative flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
              mode === entry ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {mode === entry ? (
              <motion.span
                layoutId="notes-mode"
                className="absolute inset-0 rounded-lg bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            ) : null}
            <span className="relative flex items-center gap-2">
              {entry === "photo" ? <Camera className="size-4" /> : <FileText className="size-4" />}
              {entry === "photo" ? t("photoTab") : t("textTab")}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-5">
        <AnimatePresence mode="wait" initial={false}>
          {mode === "photo" ? (
            <motion.div
              key="photo"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {photos.length > 0 ? (
                <ul className={cn("grid gap-2", photos.length > 1 ? "grid-cols-2 sm:grid-cols-3" : "")}>
                  <AnimatePresence initial={false}>
                    {photos.map((photo) => (
                      <motion.li
                        key={photo.url}
                        layout
                        initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: "spring", stiffness: 360, damping: 26 }}
                        className="group relative overflow-hidden rounded-2xl border border-border/75 bg-card"
                      >
                        <img
                          src={photo.url}
                          alt={photo.file.name}
                          className={cn("w-full object-cover", photos.length > 1 ? "aspect-square" : "max-h-80")}
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(photo.url)}
                          aria-label={`${t("remove")} ${photo.file.name}`}
                          className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition hover:text-destructive"
                        >
                          <X className="size-4" />
                        </button>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                  {photos.length < maxPhotos ? (
                    <li>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="grid size-full min-h-24 place-items-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
                      >
                        <span className="flex items-center gap-2">
                          <ImagePlus className="size-4" />
                          {t("addPhoto")}
                        </span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDragActive(false);
                    }
                  }}
                  onDrop={onDrop}
                  animate={dragActive ? { scale: [1, 1.015, 1] } : { scale: 1 }}
                  transition={dragActive ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}
                  className={cn(
                    "grid min-h-64 w-full place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40",
                    dragActive
                      ? "border-primary bg-primary/[0.07]"
                      : "border-border bg-card/60 hover:border-primary/40 hover:bg-primary/[0.03]",
                  )}
                >
                  <span>
                    <motion.span
                      className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/[0.09] text-primary"
                      whileHover={{ rotate: -6, scale: 1.05 }}
                    >
                      <Camera className="size-6" strokeWidth={1.6} />
                    </motion.span>
                    <span className="mt-4 block font-heading text-lg font-semibold">{t("dropTitle")}</span>
                    <span className="mt-1 block text-sm text-muted-foreground">{t("dropCopy")}</span>
                    <span className="mt-3 block text-xs text-muted-foreground/80">
                      {t("photoLimit", { max: maxPhotos })}
                    </span>
                  </span>
                </motion.button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple={maxPhotos > 1}
                className="sr-only"
                onChange={(event) => {
                  addFiles(Array.from(event.target.files ?? []));
                  event.target.value = "";
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="text"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <Textarea
                rows={9}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t("textPlaceholder")}
                aria-label={t("textTab")}
                className="paper-lines min-h-64 resize-y bg-card/60 leading-8"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 text-center">
        <button
          type="button"
          onClick={() => {
            setMode("text");
            setText(DEMO_PAPERS[targetLanguage].sampleNotes);
            setError(null);
          }}
          className="text-sm text-muted-foreground underline decoration-border underline-offset-4 transition hover:text-foreground hover:decoration-primary"
        >
          {t("useSample")}
        </button>
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-5">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-8 flex items-center justify-between gap-3">
        {classroomId ? (
          <span />
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={onBack}
            aria-label={tTour("back")}
            className="text-muted-foreground"
          >
            <ArrowLeft />
          </Button>
        )}
        <Button type="submit" size="lg" disabled={saving} className="group min-w-44">
          {saving ? <Loader2 className="animate-spin" /> : null}
          {saving ? t("submitting") : t("submit")}
          {!saving ? <ArrowRight className="transition-transform group-hover:translate-x-0.5" /> : null}
        </Button>
      </div>
    </form>
  );
}
