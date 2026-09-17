export type ClassroomLite = { id: string; name: string };

export type PublicUserLite = {
  id: string;
  email: string;
  username: string | null;
};

export type RecentSave = {
  classroomId: string;
  classroomName: string;
  preview: string;
  title: string;
  url: string;
  savedAt: string;
};

export type StoredState = {
  token: string | null;
  user: PublicUserLite | null;
  classrooms: ClassroomLite[];
  defaultClassroomId: string | null;
  recentSaves: RecentSave[];
};

export type ExtensionMessage = { type: "state-changed" };
