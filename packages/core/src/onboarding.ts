import type { LanguageCode } from "./languages";
import type { UiLocale } from "./messages";
import type { Category, QuestionAnswer, QuestionResponse } from "./types";

/**
 * The sample paper new users are walked through during onboarding. It lives only in
 * the browser: nothing here is written to the database, and the "student" answers
 * are filled in by the tour so the grading marks have something to land on.
 */
export type DemoQuestion = {
  id: string;
  type: "mcq" | "true_false" | "fill_blank";
  category: Category;
  stem: string;
  options: string[] | null;
  answer: QuestionAnswer;
  /** What the sample student wrote; the last question is wrong on purpose. */
  response: QuestionResponse;
  explanation: Record<UiLocale, string>;
};

export type DemoPaper = {
  /** Two short words in the language, shown on its card in the language picker. */
  greetings: [string, string];
  /** A few lines of notes in the language, offered when the user has none at hand. */
  sampleNotes: string;
  questions: DemoQuestion[];
};

type Explained = { en: string; fr: string; zh: string };

type PaperSource = {
  greetings: [string, string];
  sampleNotes: string;
  greeting: { stem: string; options: string[]; answer: number; explain: Explained };
  grammar: { stem: string; options: string[]; answer: number; explain: Explained };
  statement: { stem: string; explain: Explained };
  blank: { stem: string; answer: string; wrong: string; explain: Explained };
};

function paper(source: PaperSource): DemoPaper {
  const { greeting, grammar, statement, blank } = source;
  return {
    greetings: source.greetings,
    sampleNotes: source.sampleNotes,
    questions: [
      {
        id: "demo-1",
        type: "mcq",
        category: "phrase",
        stem: greeting.stem,
        options: greeting.options,
        answer: { index: greeting.answer },
        response: { index: greeting.answer },
        explanation: greeting.explain,
      },
      {
        id: "demo-2",
        type: "mcq",
        category: "grammar",
        stem: grammar.stem,
        options: grammar.options,
        answer: { index: grammar.answer },
        response: { index: grammar.answer },
        explanation: grammar.explain,
      },
      {
        id: "demo-3",
        type: "true_false",
        category: "vocabulary",
        stem: statement.stem,
        options: null,
        answer: { value: true },
        response: { value: true },
        explanation: statement.explain,
      },
      {
        id: "demo-4",
        type: "fill_blank",
        category: "grammar",
        stem: blank.stem,
        options: null,
        answer: { blanks: [blank.answer] },
        response: { blanks: [blank.wrong] },
        explanation: blank.explain,
      },
    ],
  };
}

const cat = (word: string): Explained => ({
  en: `${word} means "cat", so the statement is true.`,
  fr: `${word} veut dire « chat » : c'est vrai.`,
  zh: `${word} 就是“猫”，所以是对的。`,
});

export const DEMO_PAPERS: Record<LanguageCode, DemoPaper> = {
  zh: paper({
    greetings: ["你好", "谢谢"],
    sampleNotes:
      "问候\n你好！早上好！晚安！\n谢谢。不客气。\n\n量词\n一本书，一张纸，一只猫\n\n是\n我是学生。他是老师。",
    greeting: {
      stem: "早上见到老师，应该说：",
      options: ["晚安", "早上好", "再见", "不客气"],
      answer: 1,
      explain: {
        en: "早上好 (zǎoshang hǎo) means \"good morning\"; 晚安 is for bedtime.",
        fr: "早上好 (zǎoshang hǎo) veut dire « bonjour » le matin ; 晚安 se dit au coucher.",
        zh: "“早上好”用于早上打招呼；“晚安”是睡前说的。",
      },
    },
    grammar: {
      stem: "“书”用哪个量词？",
      options: ["张", "只", "本", "条"],
      answer: 2,
      explain: {
        en: "Books are counted with 本 (běn): 一本书.",
        fr: "On compte les livres avec 本 (běn) : 一本书.",
        zh: "书的量词是“本”：一本书。",
      },
    },
    statement: {
      stem: "“猫”是一种动物。",
      explain: {
        en: "猫 (māo) means \"cat\", so the statement is true.",
        fr: "猫 (māo) veut dire « chat » : c'est vrai.",
        zh: "猫就是一种动物，所以是对的。",
      },
    },
    blank: {
      stem: "我 ____ 学生。",
      answer: "是",
      wrong: "有",
      explain: {
        en: "是 (shì) links two nouns: 我是学生, \"I am a student\". 有 means \"to have\".",
        fr: "是 (shì) relie deux noms : 我是学生, « je suis étudiant ». 有 veut dire « avoir ».",
        zh: "“是”连接两个名词：我是学生。“有”表示拥有。",
      },
    },
  }),
  es: paper({
    greetings: ["Hola", "Gracias"],
    sampleNotes:
      "Saludos\n¡Hola! Buenos días. Buenas noches.\nGracias. De nada.\n\nEl plural\nel libro → los libros\nla casa → las casas\n\nSer\nyo soy, tú eres, él es\nYo soy estudiante.",
    greeting: {
      stem: "Por la mañana, para saludar a alguien, dices:",
      options: ["Buenas noches", "Hasta luego", "Buenos días", "De nada"],
      answer: 2,
      explain: {
        en: "Buenos días is the morning greeting; buenas noches is for the evening.",
        fr: "Buenos días se dit le matin ; buenas noches le soir.",
        zh: "Buenos días 是早上的问候；buenas noches 用于晚上。",
      },
    },
    grammar: {
      stem: "¿Cuál es el plural de «el libro»?",
      options: ["los libros", "las libros", "el libros", "los libro"],
      answer: 0,
      explain: {
        en: "Libro is masculine, so the article becomes los and the noun takes -s.",
        fr: "Libro est masculin : l'article devient los et le nom prend un -s.",
        zh: "libro 是阳性名词，复数冠词用 los，名词加 -s。",
      },
    },
    statement: { stem: "«Gato» es un animal.", explain: cat("Gato") },
    blank: {
      stem: "Yo ____ estudiante.",
      answer: "soy",
      wrong: "es",
      explain: {
        en: "Ser changes with the subject: yo soy, tú eres, él es.",
        fr: "Ser se conjugue selon le sujet : yo soy, tú eres, él es.",
        zh: "ser 要随主语变位：yo soy，tú eres，él es。",
      },
    },
  }),
  en: paper({
    greetings: ["Hello", "Thank you"],
    sampleNotes:
      "Greetings\nHello! Good morning. Good night.\nThank you. You're welcome.\n\nIrregular plurals\nchild → children\nman → men\n\nTo be\nI am, you are, she is\nShe is a student.",
    greeting: {
      stem: "What do you say when you meet someone in the morning?",
      options: ["Good night", "Good morning", "You're welcome", "See you later"],
      answer: 1,
      explain: {
        en: "Good morning is the morning greeting; good night is said at bedtime.",
        fr: "Good morning se dit le matin ; good night au coucher.",
        zh: "Good morning 是早上的问候；good night 是睡前说的。",
      },
    },
    grammar: {
      stem: "What is the plural of \"child\"?",
      options: ["childs", "childes", "children", "child"],
      answer: 2,
      explain: {
        en: "Child has an irregular plural: children.",
        fr: "Child a un pluriel irrégulier : children.",
        zh: "child 的复数是不规则的：children。",
      },
    },
    statement: {
      stem: "A cat is an animal.",
      explain: {
        en: "A cat is indeed an animal, so the statement is true.",
        fr: "Cat veut dire « chat » : c'est vrai.",
        zh: "cat 就是“猫”，所以是对的。",
      },
    },
    blank: {
      stem: "She ____ a student.",
      answer: "is",
      wrong: "are",
      explain: {
        en: "Be changes with the subject: I am, you are, she is.",
        fr: "Be se conjugue selon le sujet : I am, you are, she is.",
        zh: "be 要随主语变化：I am，you are，she is。",
      },
    },
  }),
  hi: paper({
    greetings: ["नमस्ते", "धन्यवाद"],
    sampleNotes:
      "अभिवादन\nनमस्ते! सुप्रभात। शुभ रात्रि।\nधन्यवाद। कोई बात नहीं।\n\nबहुवचन\nलड़का → लड़के\nकमरा → कमरे\n\nहोना\nमैं हूँ, तुम हो, वह है\nमैं छात्र हूँ।",
    greeting: {
      stem: "सुबह किसी से मिलने पर क्या कहते हैं?",
      options: ["शुभ रात्रि", "सुप्रभात", "फिर मिलेंगे", "कोई बात नहीं"],
      answer: 1,
      explain: {
        en: "सुप्रभात means \"good morning\"; शुभ रात्रि is said at night.",
        fr: "सुप्रभात veut dire « bonjour » le matin ; शुभ रात्रि se dit le soir.",
        zh: "सुप्रभात 意思是“早上好”；शुभ रात्रि 是晚上说的。",
      },
    },
    grammar: {
      stem: "“लड़का” का बहुवचन क्या है?",
      options: ["लड़कों", "लड़की", "लड़के", "लड़काएँ"],
      answer: 2,
      explain: {
        en: "Masculine nouns ending in -ā change to -e: लड़का → लड़के.",
        fr: "Les noms masculins en -ā passent à -e : लड़का → लड़के.",
        zh: "以 -ā 结尾的阳性名词复数变为 -e：लड़का → लड़के。",
      },
    },
    statement: { stem: "“बिल्ली” एक जानवर है।", explain: cat("बिल्ली") },
    blank: {
      stem: "मैं छात्र ____ ।",
      answer: "हूँ",
      wrong: "है",
      explain: {
        en: "With मैं the verb is हूँ: मैं हूँ, तुम हो, वह है.",
        fr: "Avec मैं, le verbe est हूँ : मैं हूँ, तुम हो, वह है.",
        zh: "主语是 मैं 时用 हूँ：मैं हूँ，तुम हो，वह है。",
      },
    },
  }),
  pt: paper({
    greetings: ["Olá", "Obrigado"],
    sampleNotes:
      "Cumprimentos\nOlá! Bom dia. Boa noite.\nObrigado. De nada.\n\nPlurais\no livro → os livros\no pão → os pães\n\nSer\neu sou, você é, ele é\nEu sou estudante.",
    greeting: {
      stem: "De manhã, para cumprimentar alguém, dizemos:",
      options: ["Boa noite", "Bom dia", "De nada", "Até logo"],
      answer: 1,
      explain: {
        en: "Bom dia is the morning greeting; boa noite is for the evening.",
        fr: "Bom dia se dit le matin ; boa noite le soir.",
        zh: "Bom dia 是早上的问候；boa noite 用于晚上。",
      },
    },
    grammar: {
      stem: "Qual é o plural de «o pão»?",
      options: ["os pãos", "os pães", "os paes", "o pães"],
      answer: 1,
      explain: {
        en: "Pão has an irregular plural: os pães.",
        fr: "Pão a un pluriel irrégulier : os pães.",
        zh: "pão 的复数不规则：os pães。",
      },
    },
    statement: { stem: "«Gato» é um animal.", explain: cat("Gato") },
    blank: {
      stem: "Eu ____ estudante.",
      answer: "sou",
      wrong: "é",
      explain: {
        en: "Ser changes with the subject: eu sou, você é, ele é.",
        fr: "Ser se conjugue selon le sujet : eu sou, você é, ele é.",
        zh: "ser 要随主语变位：eu sou，você é，ele é。",
      },
    },
  }),
  bn: paper({
    greetings: ["নমস্কার", "ধন্যবাদ"],
    sampleNotes:
      "শুভেচ্ছা\nনমস্কার! সুপ্রভাত। শুভ রাত্রি।\nধন্যবাদ। কোনো ব্যাপার না।\n\nবহুবচন\nবই → বইগুলো\nছাত্র → ছাত্ররা\n\nবলা\nআমি বলি, তুমি বলো, সে বলে\nআমি বাংলা বলি।",
    greeting: {
      stem: "সকালে কারও সঙ্গে দেখা হলে কী বলা হয়?",
      options: ["শুভ রাত্রি", "আবার দেখা হবে", "সুপ্রভাত", "কোনো ব্যাপার না"],
      answer: 2,
      explain: {
        en: "সুপ্রভাত means \"good morning\"; শুভ রাত্রি is said at night.",
        fr: "সুপ্রভাত veut dire « bonjour » le matin ; শুভ রাত্রি se dit le soir.",
        zh: "সুপ্রভাত 意思是“早上好”；শুভ রাত্রি 是晚上说的。",
      },
    },
    grammar: {
      stem: "“বই” শব্দের বহুবচন কোনটি?",
      options: ["বইরা", "বইগুলো", "বইজন", "বইকে"],
      answer: 1,
      explain: {
        en: "Things take -গুলো in the plural: বই → বইগুলো. -রা is for people.",
        fr: "Les objets prennent -গুলো au pluriel : বই → বইগুলো. -রা s'emploie pour les personnes.",
        zh: "物品复数加 -গুলো：বই → বইগুলো；-রা 用于人。",
      },
    },
    statement: { stem: "“বিড়াল” একটি প্রাণী।", explain: cat("বিড়াল") },
    blank: {
      stem: "আমি বাংলা ____ ।",
      answer: "বলি",
      wrong: "বলে",
      explain: {
        en: "With আমি the verb ends in -ি: আমি বলি, তুমি বলো, সে বলে.",
        fr: "Avec আমি, le verbe se termine en -ি : আমি বলি, তুমি বলো, সে বলে.",
        zh: "主语是 আমি 时动词词尾是 -ি：আমি বলি，তুমি বলো，সে বলে。",
      },
    },
  }),
  ru: paper({
    greetings: ["Привет", "Спасибо"],
    sampleNotes:
      "Приветствия\nПривет! Доброе утро. Спокойной ночи.\nСпасибо. Пожалуйста.\n\nМножественное число\nкнига → книги\nстол → столы\n\nГоворить\nя говорю, ты говоришь, он говорит\nЯ говорю по-русски.",
    greeting: {
      stem: "Что говорят утром при встрече?",
      options: ["Спокойной ночи", "Пожалуйста", "Доброе утро", "До свидания"],
      answer: 2,
      explain: {
        en: "Доброе утро means \"good morning\"; спокойной ночи is said at bedtime.",
        fr: "Доброе утро veut dire « bonjour » le matin ; спокойной ночи se dit au coucher.",
        zh: "Доброе утро 意思是“早上好”；спокойной ночи 是睡前说的。",
      },
    },
    grammar: {
      stem: "Какое множественное число у слова «книга»?",
      options: ["книгы", "книги", "книгов", "книга"],
      answer: 1,
      explain: {
        en: "After г, к, х the plural ending is -и, never -ы: книга → книги.",
        fr: "Après г, к, х, le pluriel prend -и et jamais -ы : книга → книги.",
        zh: "г、к、х 之后复数词尾用 -и，不用 -ы：книга → книги。",
      },
    },
    statement: { stem: "«Кошка» — это животное.", explain: cat("Кошка") },
    blank: {
      stem: "Я ____ по-русски.",
      answer: "говорю",
      wrong: "говорит",
      explain: {
        en: "With я the verb ends in -ю: я говорю, ты говоришь, он говорит.",
        fr: "Avec я, le verbe se termine en -ю : я говорю, ты говоришь, он говорит.",
        zh: "主语是 я 时动词词尾是 -ю：я говорю，ты говоришь，он говорит。",
      },
    },
  }),
  ja: paper({
    greetings: ["こんにちは", "ありがとう"],
    sampleNotes:
      "あいさつ\nこんにちは。おはようございます。おやすみなさい。\nありがとう。どういたしまして。\n\n数え方\n本 → 一冊、二冊\n紙 → 一枚、二枚\n\nは\nわたしは学生です。",
    greeting: {
      stem: "朝、人に会ったときのあいさつは？",
      options: ["おやすみなさい", "さようなら", "おはようございます", "どういたしまして"],
      answer: 2,
      explain: {
        en: "おはようございます is the morning greeting; おやすみなさい is said at bedtime.",
        fr: "おはようございます se dit le matin ; おやすみなさい au coucher.",
        zh: "おはようございます 是早上的问候；おやすみなさい 是睡前说的。",
      },
    },
    grammar: {
      stem: "本を数えるときに使うのは？",
      options: ["冊", "枚", "匹", "台"],
      answer: 0,
      explain: {
        en: "Books are counted with 冊 (satsu): 本が一冊.",
        fr: "On compte les livres avec 冊 (satsu) : 本が一冊.",
        zh: "数书用“冊”：本が一冊。",
      },
    },
    statement: { stem: "「ねこ」は動物です。", explain: cat("ねこ") },
    blank: {
      stem: "わたし ____ 学生です。",
      answer: "は",
      wrong: "を",
      explain: {
        en: "は marks the topic: わたしは学生です, \"I am a student\". を marks an object.",
        fr: "は marque le thème : わたしは学生です, « je suis étudiant ». を marque le complément d'objet.",
        zh: "“は”标记主题：わたしは学生です。“を”标记宾语。",
      },
    },
  }),
  vi: paper({
    greetings: ["Xin chào", "Cảm ơn"],
    sampleNotes:
      "Chào hỏi\nXin chào! Chào buổi sáng. Chúc ngủ ngon.\nCảm ơn. Không có gì.\n\nLoại từ\nmột cuốn sách, một tờ giấy, một con mèo\n\nLà\nTôi là sinh viên.",
    greeting: {
      stem: "Buổi sáng gặp ai đó, bạn nói:",
      options: ["Chúc ngủ ngon", "Không có gì", "Chào buổi sáng", "Hẹn gặp lại"],
      answer: 2,
      explain: {
        en: "Chào buổi sáng means \"good morning\"; chúc ngủ ngon is said at bedtime.",
        fr: "Chào buổi sáng veut dire « bonjour » le matin ; chúc ngủ ngon se dit au coucher.",
        zh: "Chào buổi sáng 意思是“早上好”；chúc ngủ ngon 是睡前说的。",
      },
    },
    grammar: {
      stem: "Loại từ nào đi với “sách”?",
      options: ["con", "cuốn", "tờ", "chiếc"],
      answer: 1,
      explain: {
        en: "Books take the classifier cuốn: một cuốn sách.",
        fr: "Les livres prennent le classificateur cuốn : một cuốn sách.",
        zh: "书的量词是 cuốn：một cuốn sách。",
      },
    },
    statement: { stem: "“Mèo” là một con vật.", explain: cat("Mèo") },
    blank: {
      stem: "Tôi ____ sinh viên.",
      answer: "là",
      wrong: "có",
      explain: {
        en: "Là links two nouns: tôi là sinh viên, \"I am a student\". Có means \"to have\".",
        fr: "Là relie deux noms : tôi là sinh viên, « je suis étudiant ». Có veut dire « avoir ».",
        zh: "là 连接两个名词：tôi là sinh viên。có 表示“有”。",
      },
    },
  }),
  ko: paper({
    greetings: ["안녕하세요", "감사합니다"],
    sampleNotes:
      "인사\n안녕하세요. 처음 뵙겠습니다. 잘 자요.\n감사합니다. 천만에요.\n\n단위\n책 한 권, 종이 한 장, 고양이 한 마리\n\n은/는\n저는 학생이에요.",
    greeting: {
      stem: "처음 만난 사람에게 하는 인사는?",
      options: ["잘 자요", "처음 뵙겠습니다", "안녕히 가세요", "천만에요"],
      answer: 1,
      explain: {
        en: "처음 뵙겠습니다 means \"nice to meet you\" and is said on a first meeting.",
        fr: "처음 뵙겠습니다 veut dire « enchanté » et se dit à la première rencontre.",
        zh: "처음 뵙겠습니다 意思是“初次见面”，用于第一次见面。",
      },
    },
    grammar: {
      stem: "책을 셀 때 쓰는 단위는?",
      options: ["장", "마리", "대", "권"],
      answer: 3,
      explain: {
        en: "Books are counted with 권: 책 한 권.",
        fr: "On compte les livres avec 권 : 책 한 권.",
        zh: "数书用“권”：책 한 권。",
      },
    },
    statement: { stem: "'고양이'는 동물이에요.", explain: cat("고양이") },
    blank: {
      stem: "저 ____ 학생이에요.",
      answer: "는",
      wrong: "를",
      explain: {
        en: "는 marks the topic: 저는 학생이에요, \"I am a student\". 를 marks an object.",
        fr: "는 marque le thème : 저는 학생이에요, « je suis étudiant ». 를 marque le complément d'objet.",
        zh: "“는”标记主题：저는 학생이에요。“를”标记宾语。",
      },
    },
  }),
  fr: paper({
    greetings: ["Bonjour", "Merci"],
    sampleNotes:
      "Les salutations\nBonjour ! Bonsoir. Bonne nuit.\nMerci. De rien.\n\nLe pluriel en -aux\nun cheval → des chevaux\nun journal → des journaux\n\nÊtre\nje suis, tu es, il est\nJe suis étudiant.",
    greeting: {
      stem: "Le matin, pour saluer quelqu'un, on dit :",
      options: ["Bonne nuit", "De rien", "À plus tard", "Bonjour"],
      answer: 3,
      explain: {
        en: "Bonjour is the daytime greeting; bonne nuit is said at bedtime.",
        fr: "Bonjour sert à saluer dans la journée ; bonne nuit se dit au coucher.",
        zh: "Bonjour 用于白天打招呼；bonne nuit 是睡前说的。",
      },
    },
    grammar: {
      stem: "Quel est le pluriel de « le cheval » ?",
      options: ["les chevaux", "les chevals", "les chevales", "le chevaux"],
      answer: 0,
      explain: {
        en: "Most nouns in -al change to -aux in the plural: un cheval, des chevaux.",
        fr: "La plupart des noms en -al font leur pluriel en -aux : un cheval, des chevaux.",
        zh: "以 -al 结尾的名词复数多变为 -aux：un cheval → des chevaux。",
      },
    },
    statement: {
      stem: "« Chat » est un animal.",
      explain: {
        en: "Chat means \"cat\", so the statement is true.",
        fr: "Un chat est bien un animal : c'est vrai.",
        zh: "chat 就是“猫”，所以是对的。",
      },
    },
    blank: {
      stem: "Je ____ étudiant.",
      answer: "suis",
      wrong: "es",
      explain: {
        en: "Être changes with the subject: je suis, tu es, il est.",
        fr: "Être se conjugue selon le sujet : je suis, tu es, il est.",
        zh: "être 要随主语变位：je suis，tu es，il est。",
      },
    },
  }),
};
