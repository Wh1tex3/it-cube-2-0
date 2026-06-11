import { createClient } from "@supabase/supabase-js";
import maleAvatarUrl from "./male.png";
import femaleAvatarUrl from "./female.png";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://pethjltfxanjmkbhziwt.supabase.co";
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_IQ0367Qkne1Ye0ojCWwAaA_5IXactKf";

const supabase = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;
const supabaseFunctionsUrl = supabaseUrl ? `${supabaseUrl}/functions/v1` : "";

window.supabaseClient = supabase;

const App = {
  data() {
    return {
      currentSection: "auth",
      currentUser: null,
      theme: "light",
      users: [],
      groups: [
        {
          id: "group-1",
          code: "1234",
          name: "Мобильная робототехника и программирование роботов",
          teacherName: "Иванов Иван Иванович",
        },
      ],
      instructions: [],
      collections: [],
      filters: {
        category: "",
        difficulty: "",
        showOnlyUncompleted: false,
        collectionId: "",
        search: "",
      },
      loginForm: {
        login: "",
        password: "",
        role: "user",
      },
      registerForm: {
        lastName: "",
        firstName: "",
        patronymic: "",
        associationName: "",
        groupCode: "",
        login: "",
        password: "",
        role: "user",
      },
      authError: "",
      registerError: "",
      registerSuccess: "",
      adminTab: "instructions",
      authMode: "choose",
      leaderboardLeague: "junior",
      instructionForm: {
        title: "",
        categories: "",
        collectionId: "",
        slides: 10,
        complexConnections: 2,
        programComplexity: 3,
        selfAssembly: false,
        selfProgramming: false,
        fixing: false,
        difficulty: "easy",
        imageUrl: "",
        images: [],
        imageUploadError: "",
        isDragActive: false,
        uploading: false,
        hasMotor: false,
        hasSensors: false,
        format: "pdf",
      },
      collectionForm: {
        name: "",
      },
      activeInstruction: null,
      activeInstructionImageIndex: 0,
      fullscreenInstructionImage: false,
      touchStartX: 0,
      touchStartY: 0,
      completionForm: {
        earnedExp: 0,
        confirmCode: "",
        error: "",
      },
      ui: {
        openSelect: "",
        showLoginPassword: false,
        showRegisterPassword: false,
      },
      avatarMale: maleAvatarUrl,
      avatarFemale: femaleAvatarUrl,
      backendHydrating: false,
      backendSaveTimer: null,
      backendSaveInFlight: null,
    };
  },
  computed: {
    isAdminLike() {
      return this.currentUser && (this.currentUser.role === "admin" || this.currentUser.role === "moderator");
    },
    currentUserRoleLabel() {
      return this.currentUser ? this.roleLabel(this.currentUser.role) : "";
    },
    currentUserHeaderText() {
      if (!this.currentUser) {
        return "";
      }
      const role = this.currentUserRoleLabel || "";
      if (role) {
        return this.currentUser.name + " (" + role + ")";
      }
      return this.currentUser.name;
    },
    currentGroup() {
      if (!this.currentUser) {
        return this.groups[0];
      }
      const group = this.groups.find((g) => g.id === this.currentUser.groupId);
      return group || this.groups[0];
    },
    heroAssociationName() {
      const group = this.currentGroup;
      if (group && group.name) {
        return group.name;
      }
      return "Мобильная робототехника и программирование роботов";
    },
    heroTeacherName() {
      return this.currentTeacherName || "";
    },
    currentTeacherName() {
      if (!this.currentUser) {
        return this.currentGroup.teacherName;
      }
      const admins = this.users.filter(
        (u) => u.groupId === this.currentUser.groupId && u.role === "admin" && u.active
      );
      if (!admins.length) {
        return this.currentGroup.teacherName;
      }
      const selfAdmin = admins.find((u) => u.id === this.currentUser.id);
      if (selfAdmin) {
        return selfAdmin.name;
      }
      return admins[0].name;
    },
    userCompletedCount() {
      if (!this.currentUser || !this.currentUser.completedInstructions) {
        return 0;
      }
      return this.currentUser.completedInstructions.length;
    },
    userLevel() {
      if (!this.currentUser) return 1;
      // П.7 ТЗ: уровень = 1 + floor(выполненных_инструкций / 5)
      return Math.floor(this.userCompletedCount / 5) + 1;
    },
    userLevelProgress() {
      // Процент до следующего уровня (каждые 5 инструкций = +1 уровень)
      return (this.userCompletedCount % 5) * 20;
    },
    nextLevelInstructionsRemaining() {
      if (!this.currentUser) return 0;
      const completed = this.userCompletedCount;
      const remainder = completed % 5;
      return remainder === 0 ? 5 : 5 - remainder;
    },
    nextRankInstructionsRemaining() {
      if (!this.currentUser) return 0;
      const students =
        this.leaderboardLeague === "senior"
          ? this.leaderboardSeniorSorted
          : this.leaderboardJuniorSorted;
      const index = students.findIndex((u) => u.id === this.currentUser.id);
      if (index <= 0) return 0;
      const ahead = students[index - 1];
      const myCompleted = (this.currentUser.completedInstructions || []).length;
      const aheadCompleted = (ahead.completedInstructions || []).length;
      const diff = aheadCompleted - myCompleted;
      if (diff <= 0) return 0;
      return diff + 1;
    },
    nextLevelChargePercent() {
      if (!this.currentUser) return 0;
      return this.userLevelProgress;
    },
    nextRankChargePercent() {
      if (!this.currentUser) return 0;
      const remaining = this.nextRankInstructionsRemaining;
      if (remaining === 0) return 100;
      const base = (this.currentUser.completedInstructions || []).length;
      const target = base + remaining;
      if (target <= 0) return 0;
      const progress = base / target;
      return Math.max(0, Math.min(Math.round(progress * 100), 100));
    },
    allCategories() {
      const set = new Set();
      this.groupInstructions.forEach((i) => {
        (i.categories || []).forEach((c) => set.add(c));
      });
      return Array.from(set);
    },
    categoryOptions() {
      return [{ value: "", label: "Все категории" }].concat(
        this.allCategories.map((c) => ({ value: c, label: c }))
      );
    },
    difficultyOptions() {
      return [
        { value: "", label: "Любая" },
        { value: "easy", label: "Легко" },
        { value: "medium", label: "Средне" },
        { value: "hard", label: "Сложно" },
      ];
    },
    instructionFormPreviewMaxExp() {
      return this.computeMaxExp({
        slides: this.instructionForm.slides,
        slidesCount: this.instructionForm.slides,
        complexConnections: this.instructionForm.complexConnections,
        complexConnectionsCount: this.instructionForm.complexConnections,
        selfAssemblyBonus: this.instructionForm.selfAssembly,
        selfProgrammingBonus: this.instructionForm.selfProgramming,
        fixMalfunctionBonus: this.instructionForm.fixing,
        difficulty: this.instructionForm.difficulty,
      });
    },
    teacherCurrentConfirmCode() {
      if (!this.currentUser || this.currentUser.role !== "admin") return "";
      return this.currentUser.teacherConfirmCode || "";
    },
    currentCategoryLabel() {
      const opt = this.categoryOptions.find((o) => o.value === this.filters.category);
      return (opt && opt.label) || "Все категории";
    },
    currentDifficultyLabel() {
      const opt = this.difficultyOptions.find((o) => o.value === this.filters.difficulty);
      return (opt && opt.label) || "Любая";
    },
    loginRoleLabelText() {
      return this.roleLabel(this.loginForm.role);
    },
    groupCollections() {
      const gid = this.currentUser ? this.currentUser.groupId : (this.groups[0] && this.groups[0].id);
      if (!gid) return [];
      return this.collections.filter((c) => (c.groupId || "group-1") === gid);
    },
    filteredCollections() {
      const list = this.groupCollections;
      if (!this.filters.category) {
        return list;
      }
      return list.filter(col => {
        return this.groupInstructions.some(instr => 
          instr.collectionId === col.id && instr.categories.includes(this.filters.category)
        );
      });
    },
    groupInstructions() {
      const gid = this.currentUser ? this.currentUser.groupId : (this.groups[0] && this.groups[0].id);
      if (!gid) return [];
      return this.instructions.filter((i) => (i.groupId || "group-1") === gid);
    },
    filteredInstructions() {
      let list = this.groupInstructions.slice();

      if (this.filters.category) {
        list = list.filter((i) => i.categories.includes(this.filters.category));
      }

      if (this.filters.collectionId) {
        list = list.filter((i) => i.collectionId === this.filters.collectionId);
      }

      if (this.filters.difficulty) {
        list = list.filter((i) => i.difficulty === this.filters.difficulty);
      }
      if (this.currentUser && this.filters.showOnlyUncompleted) {
        const completed = new Set(this.currentUser.completedInstructions);
        list = list.filter((i) => !completed.has(i.id));
      }
      // П.16 ТЗ: полный список всех инструкций в случайном порядке
      return list.sort(() => Math.random() - 0.5);
    },
    groupUsers() {
      if (!this.currentUser) {
        return [];
      }
      return this.users.filter((u) => u.groupId === this.currentUser.groupId && u.active);
    },
    groupTotalExp() {
      return this.groupUsers.reduce((sum, u) => sum + (u.exp || 0), 0);
    },
    groupAverageExp() {
      if (!this.groupUsers.length) {
        return 0;
      }
      return Math.round(this.groupTotalExp / this.groupUsers.length);
    },
    allUsers() {
      return this.users.filter((u) => u.active);
    },
    allAdmins() {
      return this.allUsers.filter((u) => u.role === "admin");
    },
    allStudents() {
      return this.allUsers.filter((u) => u.role === "user");
    },
    leaderboardStudents() {
      // П.8 ТЗ: убрать разделение по возрасту — все учащиеся группы в таблице
      const gid = this.currentUser ? this.currentUser.groupId : (this.groups[0] && this.groups[0].id);
      return this.allStudents.filter((u) => (u.groupId || "group-1") === (gid || "group-1"));
    },
    leaderboardJuniorSorted() {
      return [...this.leaderboardStudents].sort((a, b) => {
        const levelDiff = this.getUserLevel(b) - this.getUserLevel(a);
        if (levelDiff !== 0) return levelDiff;

        const expDiff = (b.exp || 0) - (a.exp || 0);
        if (expDiff !== 0) return expDiff;

        const aTime = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
        const bTime = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime; // тот, кто завершил ПОЗЖЕ, идёт выше

        return (a.name || "").localeCompare(b.name || "");
      });
    },
    leaderboardSeniorSorted() {
      return [...this.leaderboardStudents].sort((a, b) => {
        const expDiff = (b.exp || 0) - (a.exp || 0);
        if (expDiff !== 0) return expDiff;

        const levelDiff = this.getUserLevel(b) - this.getUserLevel(a);
        if (levelDiff !== 0) return levelDiff;

        const aTime = a.lastCompletedAt ? new Date(a.lastCompletedAt).getTime() : 0;
        const bTime = b.lastCompletedAt ? new Date(b.lastCompletedAt).getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;

        return (a.name || "").localeCompare(b.name || "");
      });
    },
    profileDaysOnPlatform() {
      if (!this.currentUser) return 0;
      const created = this.currentUser.createdAt ? new Date(this.currentUser.createdAt) : null;
      if (!created || Number.isNaN(created.getTime())) return "—";
      const days = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
      return days;
    },
    profileAgeOptions() {
      if (!this.currentUser) return [5, 6, 7, 8, 9, 10];
      if (this.currentUser.role === "user") return [5, 6, 7, 8, 9, 10];
      const arr = [];
      for (let i = 18; i <= 65; i++) arr.push(i);
      return arr;
    },
    allTotalExp() {
      return this.allUsers.reduce((sum, u) => sum + (u.exp || 0), 0);
    },
  },
  methods: {
    getUserAvatar(user) {
      if (!user) return null;
      const g = user.gender || "";
      if (g === "male") return this.avatarMale;
      if (g === "female") return this.avatarFemale;
      return null;
    },
    getAvatarLetter(user) {
      if (!user || !user.name) return "?";
      const n = String(user.name).trim();
      return (n[0] || "?").toUpperCase();
    },
    updateProfileField(field, value) {
      if (!this.currentUser) return;
      const idx = this.users.findIndex((u) => u.id === this.currentUser.id);
      if (idx === -1) return;
      this.users[idx][field] = value;
      this.currentUser = JSON.parse(JSON.stringify(this.users[idx]));
      this.saveState();
    },
    getCollectionImage(collectionId, index) {
      if (!Array.isArray(this.groupInstructions)) return "";
      const instrs = this.groupInstructions.filter(i => i.collectionId === collectionId);
      if (instrs[index]) {
        return this.primaryInstructionImage(instrs[index]);
      }
      return ""; // Or a placeholder
    },
    instructionImages(instruction) {
      if (!instruction) return [];
      if (Array.isArray(instruction.images) && instruction.images.length) {
        return instruction.images.filter((image) => image && image.url);
      }
      if (instruction.imageUrl) {
        return [{ url: instruction.imageUrl, name: instruction.title || "instruction" }];
      }
      return [];
    },
    primaryInstructionImage(instruction) {
      const images = this.instructionImages(instruction);
      return images.length ? images[0].url : "";
    },
    activeInstructionImages() {
      return this.instructionImages(this.activeInstruction);
    },
    activeInstructionImage() {
      const images = this.activeInstructionImages();
      if (!images.length) return null;
      const index = Math.min(Math.max(this.activeInstructionImageIndex, 0), images.length - 1);
      return images[index] || images[0];
    },
    setInstructionImage(index) {
      const images = this.activeInstructionImages();
      if (!images.length) {
        this.activeInstructionImageIndex = 0;
        return;
      }
      const last = images.length - 1;
      this.activeInstructionImageIndex = Math.min(Math.max(index, 0), last);
    },
    showNextInstructionImage() {
      const images = this.activeInstructionImages();
      if (images.length <= 1) return;
      this.activeInstructionImageIndex = (this.activeInstructionImageIndex + 1) % images.length;
    },
    showPrevInstructionImage() {
      const images = this.activeInstructionImages();
      if (images.length <= 1) return;
      this.activeInstructionImageIndex = (this.activeInstructionImageIndex - 1 + images.length) % images.length;
    },
    openFullscreenInstructionImage() {
      if (!this.activeInstructionImage()) return;
      this.fullscreenInstructionImage = true;
      document.body.classList.add("instruction-fullscreen-open");
    },
    closeFullscreenInstructionImage() {
      this.fullscreenInstructionImage = false;
      document.body.classList.remove("instruction-fullscreen-open");
    },
    handleInstructionTouchStart(event) {
      const touch = event.touches && event.touches[0];
      if (!touch) return;
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
    },
    handleInstructionTouchEnd(event) {
      const touch = event.changedTouches && event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - this.touchStartX;
      const deltaY = touch.clientY - this.touchStartY;
      if (Math.abs(deltaX) < 40 || Math.abs(deltaX) < Math.abs(deltaY)) return;
      if (deltaX < 0) {
        this.showNextInstructionImage();
      } else {
        this.showPrevInstructionImage();
      }
    },
    goSection(section) {
      if (section === "profile" && !this.currentUser) {
        this.currentSection = "auth";
        return;
      }
      this.currentSection = section;
    },
    handleCollectionClick(col) {
      if (this.filters.collectionId === col.id) {
        this.filters.collectionId = "";
        return;
      }
      this.filters.collectionId = col.id;
      this.$nextTick(() => {
        const target = document.querySelector(".instruction-grid");
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      });
    },
    applyTheme() {
      const root = document.documentElement;
      if (this.theme === "dark") {
        root.classList.add("theme-dark");
      } else {
        root.classList.remove("theme-dark");
      }
      window.localStorage.setItem("site-theme", this.theme);
    },
    toggleTheme() {
      this.theme = this.theme === "dark" ? "light" : "dark";
      this.applyTheme();
    },
    toggleSelect(name) {
      this.ui.openSelect = this.ui.openSelect === name ? "" : name;
    },
    closeAllSelects() {
      this.ui.openSelect = "";
    },
    selectLoginRole(value) {
      this.loginForm.role = value;
      this.closeAllSelects();
    },
    selectFilterCategory(value) {
      this.filters.category = value;
      this.filters.collectionId = ""; // Reset collection when category changes
      this.closeAllSelects();
    },
    selectFilterDifficulty(value) {
      this.filters.difficulty = value;
      this.closeAllSelects();
    },
    getUserLevel(user) {
      if (!user || !user.completedInstructions) return 1;
      return Math.floor((user.completedInstructions.length || 0) / 5) + 1;
    },
    getUserCompletedCount(user) {
      if (!user || !user.completedInstructions) return 0;
      return (user.completedInstructions || []).length;
    },
    roleLabel(role) {
      if (role === "user") return "Учащийся";
      if (role === "admin") return "Администратор";
      if (role === "moderator") return "Модератор";
      return role;
    },
    difficultyLabel(value) {
      if (value === "easy") return "Легко";
      if (value === "medium") return "Средне";
      if (value === "hard") return "Сложно";
      return value;
    },
    instructionCardClass(instruction) {
      if (!this.currentUser) {
        return "easy-not-completed";
      }
      const completed = this.currentUser.completedInstructions.includes(instruction.id);
      const base = instruction.difficulty;
      return `${base}-${completed ? "completed" : "not-completed"}`;
    },
    starClass(instruction) {
      if (!this.currentUser) {
        return "star-easy-not-completed";
      }
      const completed = this.currentUser.completedInstructions.includes(instruction.id);
      if (completed) {
        return "star-completed";
      }
      if (instruction.difficulty === "easy") return "star-easy-not-completed";
      if (instruction.difficulty === "medium") return "star-medium-not-completed";
      if (instruction.difficulty === "hard") return "star-hard-not-completed";
      return "";
    },
    instructionExperienceLabel(instruction) {
      if (!this.currentUser) {
        return `Макс. ${this.computeMaxExp(instruction)}`;
      }
      const record = this.currentUser.instructionResults[instruction.id];
      if (!record) {
        return `Макс. ${this.computeMaxExp(instruction)}`;
      }
      return `${record.earnedExp}`;
    },
    defaultInstructionDescription(instruction) {
      const difficultyText = this.difficultyLabel(instruction.difficulty);
      const slides = Number(instruction.slidesCount || instruction.slides || 0);
      const hasProgrammingBonus = instruction.selfProgrammingBonus;
      const hasFixBonus = instruction.fixMalfunctionBonus;
      const parts = [];
      parts.push(`Собери робота «${instruction.title}» по бумажной или экранной инструкции.`);
      if (slides) {
        parts.push(`Всего примерно ${slides} шагов сборки.`);
      }
      if (hasProgrammingBonus) {
        parts.push("После сборки запрограммируй робота, чтобы он выполнял задание.");
      }
      if (hasFixBonus) {
        parts.push("Если робот ведёт себя не так, попробуй найти и исправить ошибку.");
      }
      parts.push(`Это уровень сложности: ${difficultyText}.`);
      return parts.join(" ");
    },
    computeMaxExp(instruction) {
      const slides = Number(instruction.slidesCount || instruction.slides || 0);
      const complexConnections = Number(instruction.complexConnectionsCount || instruction.complexConnections || 0);

      // Вес опыта за слайд в зависимости от сложности
      let diffWeight = 1;
      if (instruction.difficulty === "medium") diffWeight = 2;
      if (instruction.difficulty === "hard") diffWeight = 3;

      // Сложные этапы всегда константа 3 (умножает вес этапа на 3)
      const complexStepWeight = diffWeight * 3;

      // Базовый расчет: (Обычные слайды * Вес) + (Сложные слайды * ВесСложного)
      // Считаем complexConnections как количество сложных этапов
      const normalSlides = Math.max(0, slides - complexConnections);
      let base = (normalSlides * diffWeight) + (complexConnections * complexStepWeight);

      // Бонусы: +10% за самостоятельную сборку и программирование
      if (instruction.selfAssemblyBonus) {
        base += base * 0.1;
      }
      if (instruction.selfProgrammingBonus) {
        base += base * 0.1;
      }
      // Бонус за исправление ошибок
      if (instruction.fixMalfunctionBonus) {
        base += base * 0.1;
      }

      return Math.round(base);
    },
    fallbackImageForInstruction(instruction) {
      const title = instruction.title || "Робот";
      let bg = "#bfdbfe";
      if (instruction.difficulty === "medium") {
        bg = "#fde68a";
      } else if (instruction.difficulty === "hard") {
        bg = "#fecaca";
      }
      const svg =
        "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>" +
        `<rect width='600' height='400' fill='${bg}'/>` +
        "<g transform='translate(100,120)' fill='none' stroke='#111827' stroke-width='4'>" +
        "<rect x='40' y='80' width='260' height='120' rx='24' fill='white'/>" +
        "<circle cx='90' cy='200' r='28' fill='white'/>" +
        "<circle cx='250' cy='200' r='28' fill='white'/>" +
        "</g>" +
        `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-size='28' fill='#111827' font-family='system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif'>${title}</text>` +
        "</svg>";
      return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
    },
    onInstructionImageError(event, instruction) {
      if (!event || !event.target) {
        return;
      }
      event.target.onerror = null;
      event.target.src = this.fallbackImageForInstruction(instruction);
    },
    normalizeEmail(value) {
      return String(value || "").trim().toLowerCase();
    },
    hashLogin(value) {
      let hash = 0x811c9dc5;
      const text = String(value || "").trim().toLowerCase();
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, "0");
    },
    technicalEmailForLogin(login) {
      const raw = String(login || "").trim().toLowerCase();
      const slug = raw
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 32) || "user";
      return `${slug}-${this.hashLogin(raw)}@pethjltfxanjmkbhziwt.supabase.co`;
    },
    formatSupabaseAuthError(message) {
      const text = String(message || "").trim();
      const normalized = text.toLowerCase();
      if (normalized.includes("already") || normalized.includes("registered") || normalized.includes("exists")) {
        return "Пользователь с таким логином уже существует.";
      }
      if (normalized.includes("email rate limit")) {
        return "Supabase временно ограничил отправку писем подтверждения. Подождите немного или настройте SMTP/подтверждение email в Supabase Auth.";
      }
      if (normalized.includes("invalid") && normalized.includes("email")) {
        return "Supabase отклонил этот email. Укажите реальный email-адрес.";
      }
      return text || "Supabase не смог создать пользователя.";
    },
    async createSupabaseUserByLogin(payload) {
      const response = await fetch(`${supabaseFunctionsUrl}/signup-by-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabasePublishableKey,
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Supabase не смог создать пользователя.");
      }
      return result.user;
    },
    generateGroupId() {
      return `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    },
    generateGroupCode() {
      let code = "";
      do {
        code = String(1000 + Math.floor(Math.random() * 9000));
      } while (this.groups.some((group) => String(group.code) === code));
      return code;
    },
    buildGroupFromAuthMetadata(meta, fallbackName = "") {
      const groupId = meta && meta.group_id ? String(meta.group_id) : "";
      if (!groupId) return null;
      const existing = this.groups.find((group) => group.id === groupId);
      if (existing) return existing;
      const group = {
        id: groupId,
        code: meta.group_code ? String(meta.group_code) : this.generateGroupCode(),
        name: meta.group_name ? String(meta.group_name) : "Моё объединение",
        teacherName: meta.full_name ? String(meta.full_name) : fallbackName,
      };
      this.groups.push(group);
      return group;
    },
    statePayload() {
      return {
        users: this.users,
        instructions: this.instructions,
        collections: this.collections,
        groups: this.groups,
      };
    },
    normalizeLoadedData() {
      this.users.forEach((u) => {
        if (!u.completedInstructions) u.completedInstructions = [];
        if (!u.instructionResults) u.instructionResults = {};
        if (u.lastCompletedAt === undefined) u.lastCompletedAt = null;
        if (u.teacherConfirmCode === undefined) u.teacherConfirmCode = "";
        if (u.email === undefined) u.email = "";
        if (u.supabaseAuthId === undefined) u.supabaseAuthId = "";
        if (u.gender === undefined) u.gender = "";
        if (u.age === undefined) u.age = u.role === "user" ? 0 : 30;
        if (!u.createdAt && u.activeUntil) {
          const date = new Date(u.activeUntil);
          date.setDate(date.getDate() - 90);
          u.createdAt = date.toISOString();
        }
      });
      this.collections.forEach((collection) => {
        if (!collection.groupId) collection.groupId = "group-1";
      });
      this.instructions.forEach((instruction) => {
        if (!instruction.groupId) instruction.groupId = "group-1";
        if (!instruction.difficulty) instruction.difficulty = "easy";
        if (instruction.difficulty === "advanced") instruction.difficulty = "hard";
        if (!Array.isArray(instruction.images)) {
          instruction.images = instruction.imageUrl ? [{ url: instruction.imageUrl, name: instruction.title || "instruction" }] : [];
        }
        if (!instruction.imageUrl && instruction.images.length && instruction.images[0].url) {
          instruction.imageUrl = instruction.images[0].url;
        }
      });
    },
    async loadStateFromSupabase() {
      if (!supabaseFunctionsUrl || !supabasePublishableKey) {
        return false;
      }
      try {
        const { data } = supabase ? await supabase.auth.getSession() : { data: null };
        const token = data && data.session ? data.session.access_token : "";
        const headers = { apikey: supabasePublishableKey };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        const response = await fetch(`${supabaseFunctionsUrl}/app-state`, {
          headers,
        });
        if (!response.ok) {
          return false;
        }
        const parsed = await response.json();
        const hasRemoteData = ["users", "groups", "instructions", "collections"].some(
          (key) => Array.isArray(parsed[key]) && parsed[key].length > 0
        );
        if (!hasRemoteData) {
          return false;
        }
        this.backendHydrating = true;
        if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
          this.groups = parsed.groups;
        }
        if (!token) {
          window.localStorage.setItem("robot-site-state", JSON.stringify(this.statePayload()));
          return true;
        }
        if (Array.isArray(parsed.users) && parsed.users.length > 0) {
          this.users = parsed.users;
        }
        this.instructions = parsed.instructions || [];
        this.collections = parsed.collections || [];
        this.normalizeLoadedData();
        if (this.currentUser) {
          const freshUser = this.users.find((u) => u.id === this.currentUser.id || u.login === this.currentUser.login);
          if (freshUser) {
            this.currentUser = JSON.parse(JSON.stringify(freshUser));
          }
        }
        window.localStorage.setItem("robot-site-state", JSON.stringify(this.statePayload()));
        return true;
      } catch (error) {
        console.warn("Supabase state load failed:", error.message);
        return false;
      } finally {
        this.backendHydrating = false;
      }
    },
    queueBackendSave(payload) {
      if (this.backendHydrating || !supabase || !supabaseFunctionsUrl) {
        return;
      }
      if (this.backendSaveTimer) {
        window.clearTimeout(this.backendSaveTimer);
      }
      this.backendSaveTimer = window.setTimeout(() => {
        this.syncStateToSupabase(payload);
      }, 500);
    },
    async ensureSupabaseSessionForCurrentUser() {
      if (!supabase) {
        return null;
      }
      const { data } = await supabase.auth.getSession();
      if (data && data.session) {
        return data.session;
      }
      if (!this.currentUser || !this.currentUser.login || !this.currentUser.password) {
        return null;
      }
      const email = this.currentUser.email || this.technicalEmailForLogin(this.currentUser.login);
      const { data: signInData, error } = await supabase.auth.signInWithPassword({
        email,
        password: this.currentUser.password,
      });
      if (error) {
        console.warn("Supabase session restore failed:", error.message);
        return null;
      }
      return signInData && signInData.session ? signInData.session : null;
    },
    async syncStateToSupabase(payload) {
      if (!supabase || !supabaseFunctionsUrl) {
        return;
      }
      try {
        const session = await this.ensureSupabaseSessionForCurrentUser();
        if (!session || !session.access_token) {
          return;
        }
        const response = await fetch(`${supabaseFunctionsUrl}/app-state`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: supabasePublishableKey,
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          console.warn("Supabase state save failed:", result.error || response.statusText);
        }
      } catch (error) {
        console.warn("Supabase state save failed:", error && error.message ? error.message : error);
      }
    },
    async saveStateNow() {
      const payload = this.statePayload();
      window.localStorage.setItem("robot-site-state", JSON.stringify(payload));
      if (this.backendSaveTimer) {
        window.clearTimeout(this.backendSaveTimer);
        this.backendSaveTimer = null;
      }
      if (this.backendHydrating) {
        return;
      }
      this.backendSaveInFlight = this.syncStateToSupabase(payload);
      await this.backendSaveInFlight;
      this.backendSaveInFlight = null;
    },
    async handleLogin() {
      this.authError = "";
      const { login, password, role } = this.loginForm;
      const loginValue = String(login || "").trim();
      const passwordValue = String(password || "");
      const loginEmail = this.normalizeEmail(loginValue);
      const technicalEmail = this.technicalEmailForLogin(loginValue);

      if (supabase && loginValue) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: technicalEmail,
          password: passwordValue,
        });
        if (!error && data && data.user) {
          await this.loadStateFromSupabase();
          const meta = data.user.user_metadata || {};
          let supabaseUser = this.users.find((u) => (
            (u.supabaseAuthId && u.supabaseAuthId === data.user.id) ||
            (u.email && this.normalizeEmail(u.email) === technicalEmail)
          ));
          if (!supabaseUser) {
            const group = this.buildGroupFromAuthMetadata(meta, meta.full_name || loginValue);
            if (!group) {
              this.authError = "Не удалось найти объединение аккаунта. Проверьте код объединения у педагога.";
              await supabase.auth.signOut();
              return;
            }
            const now = new Date();
            const activeUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
            supabaseUser = {
              id: data.user.id,
              supabaseAuthId: data.user.id,
              email: data.user.email || technicalEmail,
              name: meta.full_name || data.user.email || loginValue,
              login: meta.login || data.user.email || loginValue,
              password: passwordValue,
              role: meta.role || role,
              groupId: group.id,
              exp: 0,
              completedInstructions: [],
              instructionResults: {},
              teacherConfirmCode: "",
              lastCompletedAt: null,
              active: true,
              activeUntil: activeUntil.toISOString(),
              createdAt: now.toISOString(),
              gender: "",
              age: 0,
            };
            this.users.push(supabaseUser);
            await this.saveStateNow();
          }
          if (supabaseUser.role === role && supabaseUser.active !== false) {
            this.currentUser = JSON.parse(JSON.stringify(supabaseUser));
            await this.saveStateNow();
            this.goSection("instructions");
            return;
          }
        }
      }

      const found = this.users.find((u) => (
        (u.login === loginValue || (u.email && this.normalizeEmail(u.email) === loginEmail)) &&
        u.password === passwordValue &&
        u.role === role &&
        u.active
      ));
      if (!found) {
        this.authError = "Неверные данные или аккаунт не активен.";
        return;
      }
      this.currentUser = JSON.parse(JSON.stringify(found));
      this.saveState();
      this.goSection("instructions");
    },
    async handleRegister() {
      this.registerError = "";
      this.registerSuccess = "";
      const lastName = (this.registerForm.lastName || "").trim();
      if (!lastName) {
        this.registerError = "Фамилия обязательна для заполнения.";
        return;
      }
      const firstName = (this.registerForm.firstName || "").trim();
      const patronymic = (this.registerForm.patronymic || "").trim();
      const fullName = [lastName, firstName, patronymic].filter(Boolean).join(" ");
      const login = String(this.registerForm.login || "").trim();
      const password = String(this.registerForm.password || "");
      const email = this.technicalEmailForLogin(login);

      if (!supabase) {
        this.registerError = "Supabase не настроен. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_PUBLISHABLE_KEY.";
        return;
      }
      if (!login) {
        this.registerError = "Укажите логин.";
        return;
      }
      if (password.length < 6) {
        this.registerError = "Пароль должен быть не короче 6 символов.";
        return;
      }

      let group;
      let pendingGroup = null;
      if (this.registerForm.role === "admin") {
        const associationName = (this.registerForm.associationName || "").trim();
        if (!associationName) {
          this.registerError = "Укажите название объединения.";
          return;
        }
        const newGroupId = this.generateGroupId();
        const newCode = this.generateGroupCode();
        group = {
          id: newGroupId,
          code: newCode,
          name: associationName,
          teacherName: fullName,
        };
        pendingGroup = group;
      } else {
        group = this.groups.find((g) => g.code === this.registerForm.groupCode);
        if (!group) {
          this.registerError = "Неверный код объединения.";
          return;
        }
      }
      const exists = this.users.some((u) => (
        u.login === login ||
        (u.email && this.normalizeEmail(u.email) === email)
      ));
      if (exists) {
        this.registerError = "Пользователь с таким логином уже существует.";
        return;
      }
      const role = this.registerForm.role === "admin" ? "admin" : "user";
      let supabaseUser;
      try {
        supabaseUser = await this.createSupabaseUserByLogin({
          login,
          password,
          metadata: {
            full_name: fullName,
            first_name: firstName,
            last_name: lastName,
            patronymic,
            role,
            group_id: group.id,
            group_name: group.name,
            group_code: group.code,
          },
        });
      } catch (error) {
        this.registerError = this.formatSupabaseAuthError(error.message);
        return;
      }
      if (!supabaseUser || !supabaseUser.id) {
        this.registerError = "Supabase не вернул созданного пользователя.";
        return;
      }
      if (supabaseUser.email) {
        const duplicateEmail = this.users.some((u) => u.email && this.normalizeEmail(u.email) === this.normalizeEmail(supabaseUser.email));
        if (duplicateEmail) {
          this.registerError = "Пользователь с таким логином уже существует.";
          return;
        }
      }
      const supabaseAuthId = supabaseUser.id;
      const supabaseEmail = supabaseUser.email || email;
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: supabaseEmail,
        password,
      });
      if (signInError) {
        this.registerError = this.formatSupabaseAuthError(signInError.message);
        return;
      }

      const now = new Date();
      const activeUntil = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 90);
      const newUser = {
        id: supabaseAuthId || `user-${Date.now()}`,
        supabaseAuthId,
        email: supabaseEmail,
        name: fullName,
        login,
        password,
        role,
        groupId: group.id,
        exp: 0,
        completedInstructions: [],
        instructionResults: {},
        teacherConfirmCode: "",
        lastCompletedAt: null,
        active: true,
        activeUntil: activeUntil.toISOString(),
        createdAt: now.toISOString(),
        gender: "",
        age: 0,
      };
      if (pendingGroup) {
        this.groups.push(pendingGroup);
      }
      this.users.push(newUser);
      this.currentUser = JSON.parse(JSON.stringify(newUser));
      await this.saveStateNow();
      this.goSection("instructions");
      this.registerForm.lastName = "";
      this.registerForm.firstName = "";
      this.registerForm.patronymic = "";
      this.registerForm.associationName = "";
      this.registerForm.login = "";
      this.registerForm.password = "";
      this.registerForm.groupCode = "";
      this.registerForm.role = "user";
    },
    async logout() {
      if (supabase) {
        await supabase.auth.signOut();
      }
      this.currentUser = null;
      this.goSection("auth");
    },
    openInstruction(instruction) {
      this.activeInstruction = instruction;
      this.activeInstructionImageIndex = 0;
      this.fullscreenInstructionImage = false;
      document.body.classList.remove("instruction-fullscreen-open");
      const maxExp = this.computeMaxExp(instruction);
      this.completionForm.earnedExp = maxExp;
      this.completionForm.confirmCode = "";
      this.completionForm.error = "";
      const modalElement = document.getElementById("instructionModal");
      if (modalElement) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
        modal.show();
      }
    },
    completeInstructionWithCode() {
      if (!this.currentUser || !this.activeInstruction) {
        return;
      }
      const code = String(this.completionForm.confirmCode || "").trim();
      if (!code) {
        this.completionForm.error = "Введите код подтверждения от преподавателя.";
        return;
      }
      const groupId = this.currentUser.groupId;
      const teachers = this.users.filter(
        (u) =>
          u.active &&
          u.role === "admin" &&
          u.groupId === groupId &&
          u.teacherConfirmCode
      );
      const ok = teachers.some((t) => t.teacherConfirmCode === code);
      if (!ok) {
        this.completionForm.error = "Неверный код подтверждения. Обратитесь к преподавателю.";
        return;
      }
      this.completionForm.error = "";
      const maxExp = this.computeMaxExp(this.activeInstruction);
      this.completionForm.earnedExp = maxExp;
      this.completeInstruction();
      this.completionForm.confirmCode = "";
    },
    completeInstructionMax() {
      if (!this.currentUser || !this.activeInstruction) {
        return;
      }
      const maxExp = this.computeMaxExp(this.activeInstruction);
      this.completionForm.earnedExp = maxExp;
      this.completeInstruction();
    },
    completeInstruction() {
      if (!this.currentUser || !this.activeInstruction) {
        return;
      }
      const maxExp = this.computeMaxExp(this.activeInstruction);
      const earned = Math.max(0, Math.min(Number(this.completionForm.earnedExp) || 0, maxExp));
      const userIndex = this.users.findIndex((u) => u.id === this.currentUser.id);
      if (userIndex === -1) {
        return;
      }
      const user = this.users[userIndex];
      if (!user.instructionResults) {
        user.instructionResults = {};
      }
      const prev = user.instructionResults[this.activeInstruction.id];
      const prevEarned = prev ? prev.earnedExp : 0;
      user.exp = (user.exp || 0) - prevEarned + earned;
      user.instructionResults[this.activeInstruction.id] = {
        earnedExp: earned,
      };
      if (!user.completedInstructions.includes(this.activeInstruction.id)) {
        user.completedInstructions.push(this.activeInstruction.id);
      }
      if (earned > 0) {
        user.lastCompletedAt = new Date().toISOString();
      }
      this.users.splice(userIndex, 1, user);
      this.currentUser = JSON.parse(JSON.stringify(user));
      this.saveState();
      const modalElement = document.getElementById("instructionModal");
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    },
    sanitizeStorageSegment(value) {
      return String(value || "file")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "file";
    },
    formatFileSize(bytes) {
      const size = Number(bytes || 0);
      if (size < 1024) return `${size} Б`;
      if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
      return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
    },
    triggerInstructionImagePicker() {
      if (this.$refs.instructionImagesInput) {
        this.$refs.instructionImagesInput.click();
      }
    },
    handleInstructionImageInput(event) {
      this.addInstructionImageFiles(event && event.target ? event.target.files : []);
      if (event && event.target) {
        event.target.value = "";
      }
    },
    handleInstructionImageDrop(event) {
      this.instructionForm.isDragActive = false;
      this.addInstructionImageFiles(event && event.dataTransfer ? event.dataTransfer.files : []);
    },
    addInstructionImageFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return;
      this.instructionForm.imageUploadError = "";
      const accepted = files.filter((file) => file && file.type && file.type.startsWith("image/"));
      if (accepted.length !== files.length) {
        this.instructionForm.imageUploadError = "Можно прикреплять только изображения.";
      }
      const freeSlots = Math.max(0, 200 - this.instructionForm.images.length);
      if (accepted.length > freeSlots) {
        this.instructionForm.imageUploadError = "К одной инструкции можно прикрепить до 200 изображений.";
      }
      accepted.slice(0, freeSlots).forEach((file) => {
        this.instructionForm.images.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          previewUrl: URL.createObjectURL(file),
        });
      });
    },
    removeInstructionImage(index) {
      const [removed] = this.instructionForm.images.splice(index, 1);
      if (removed && removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
    },
    clearInstructionImages() {
      this.instructionForm.images.forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      this.instructionForm.images = [];
      this.instructionForm.imageUploadError = "";
      this.instructionForm.isDragActive = false;
      this.instructionForm.uploading = false;
    },
    async uploadInstructionImages(instructionId) {
      if (!this.instructionForm.images.length) {
        return [];
      }
      if (!supabase) {
        throw new Error("\u0053\u0075\u0070\u0061\u0062\u0061\u0073\u0065 \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d \u0434\u043b\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439.");
      }
      const session = await this.ensureSupabaseSessionForCurrentUser();
      if (!session) {
        throw new Error("\u0414\u043b\u044f \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0438\u0437\u043e\u0431\u0440\u0430\u0436\u0435\u043d\u0438\u0439 \u0432\u043e\u0439\u0434\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0439 \u0430\u043a\u043a\u0430\u0443\u043d\u0442 \u043f\u0435\u0434\u0430\u0433\u043e\u0433\u0430.");
      }
      const groupId = this.currentUser ? this.currentUser.groupId : "group-1";
      const bucket = supabase.storage.from("instruction-images");
      const uploaded = [];
      for (let index = 0; index < this.instructionForm.images.length; index += 1) {
        const item = this.instructionForm.images[index];
        const extension = (item.name.split(".").pop() || "jpg").toLowerCase();
        const baseName = this.sanitizeStorageSegment(item.name.replace(/\.[^.]+$/, ""));
        const path = `${this.sanitizeStorageSegment(groupId)}/${this.sanitizeStorageSegment(instructionId)}/${String(index + 1).padStart(3, "0")}-${Date.now()}-${baseName}.${extension}`;
        try {
          uploaded.push(await this.uploadInstructionImageDirect(bucket, path, item, index));
        } catch (error) {
          if (!this.isRecoverableStorageUploadError(error)) {
            throw new Error(`\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c "${item.name}": ${this.errorMessage(error)}`);
          }
          try {
            uploaded.push(await this.uploadInstructionImageViaFunction({
              item,
              instructionId,
              groupId,
              order: index + 1,
              session,
            }));
          } catch (fallbackError) {
            throw new Error(`\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c "${item.name}": ${this.errorMessage(fallbackError)}`);
          }
        }
      }
      return uploaded;
    },
    async uploadInstructionImageDirect(bucket, path, item, index) {
      const { error } = await bucket.upload(path, item.file, {
        cacheControl: "31536000",
        contentType: item.type || "image/jpeg",
        upsert: false,
      });
      if (error) {
        throw error;
      }
      const { data } = bucket.getPublicUrl(path);
      return {
        url: data.publicUrl,
        path,
        name: item.name,
        size: item.size,
        type: item.type,
        order: index,
        uploadedAt: new Date().toISOString(),
      };
    },
    async uploadInstructionImageViaFunction({ item, instructionId, groupId, order, session }) {
      if (!supabaseFunctionsUrl) {
        throw new Error("\u0053\u0075\u0070\u0061\u0062\u0061\u0073\u0065 \u0045\u0064\u0067\u0065 \u0046\u0075\u006e\u0063\u0074\u0069\u006f\u006e \u043d\u0435 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043d\u0430.");
      }
      const formData = new FormData();
      formData.append("file", item.file, item.name);
      formData.append("groupId", groupId);
      formData.append("instructionId", instructionId);
      formData.append("order", String(order));
      const response = await fetch(`${supabaseFunctionsUrl}/upload-instruction-image`, {
        method: "POST",
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || response.statusText || "Upload failed");
      }
      return {
        url: result.publicUrl,
        path: result.path,
        name: result.name || item.name,
        size: result.size || item.size,
        type: result.type || item.type,
        order: order - 1,
        uploadedAt: result.uploadedAt || new Date().toISOString(),
      };
    },
    isRecoverableStorageUploadError(error) {
      const message = this.errorMessage(error).toLowerCase();
      return (
        message.includes("failed to fetch") ||
        message.includes("networkerror") ||
        message.includes("network request failed") ||
        message.includes("load failed") ||
        message.includes("fetch failed")
      );
    },
    errorMessage(error) {
      if (!error) return "\u043d\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043d\u0430\u044f \u043e\u0448\u0438\u0431\u043a\u0430";
      if (typeof error === "string") return error;
      return error.message || String(error);
    },
    resetInstructionForm() {
      this.instructionForm.title = "";
      this.instructionForm.categories = "";
      this.instructionForm.collectionId = "";
      this.instructionForm.slides = 10;
      this.instructionForm.complexConnections = 2;
      this.instructionForm.programComplexity = 3;
      this.instructionForm.selfAssembly = false;
      this.instructionForm.selfProgramming = false;
      this.instructionForm.fixing = false;
      this.instructionForm.difficulty = "easy";
      this.instructionForm.imageUrl = "";
      this.instructionForm.hasMotor = false;
      this.instructionForm.hasSensors = false;
      this.instructionForm.format = "pdf";
      this.clearInstructionImages();
    },
    async createInstruction() {
      if (this.instructionForm.uploading) {
        return;
      }
      const categories = this.instructionForm.categories
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      const instructionId = `instr-${Date.now()}`;
      this.instructionForm.uploading = true;
      this.instructionForm.imageUploadError = "";
      let uploadedImages = [];
      try {
        uploadedImages = await this.uploadInstructionImages(instructionId);
      } catch (error) {
        this.instructionForm.imageUploadError = error instanceof Error ? error.message : "Не удалось загрузить изображения.";
        this.instructionForm.uploading = false;
        return;
      }
      const instruction = {
        id: instructionId,
        title: this.instructionForm.title,
        categories,
        collectionId: this.instructionForm.collectionId || "",
        groupId: this.currentUser ? this.currentUser.groupId : "group-1",
        slidesCount: this.instructionForm.slides,
        complexConnectionsCount: this.instructionForm.complexConnections,
        programComplexity: this.instructionForm.programComplexity,
        selfAssemblyBonus: this.instructionForm.selfAssembly,
        selfProgrammingBonus: this.instructionForm.selfProgramming,
        fixMalfunctionBonus: this.instructionForm.fixing,
        difficulty: this.instructionForm.difficulty,
        imageUrl: uploadedImages.length ? uploadedImages[0].url : "",
        images: uploadedImages,
        hasMotor: this.instructionForm.hasMotor,
        hasSensors: this.instructionForm.hasSensors,
        format: this.instructionForm.format,
      };
      this.instructions.push(instruction);
      await this.saveStateNow();
      this.resetInstructionForm();
    },
    async createCollection() {
      const name = this.collectionForm.name.trim();
      if (!name || !this.currentUser) {
        return;
      }
      const collection = {
        id: `col-${Date.now()}`,
        name,
        groupId: this.currentUser.groupId,
      };
      this.collections.push(collection);
      await this.saveStateNow();
      this.collectionForm.name = "";
    },
    collectionInstructionCount(collectionId) {
      return this.groupInstructions.filter((i) => i.collectionId === collectionId).length;
    },
    canManageGroupItem(item) {
      if (!this.currentUser || !item) return false;
      if (this.currentUser.role !== "admin" && this.currentUser.role !== "moderator") return false;
      return (item.groupId || "group-1") === (this.currentUser.groupId || "group-1");
    },
    updateInstructionCollection(instruction, collectionId) {
      if (!this.canManageGroupItem(instruction)) return;
      const index = this.instructions.findIndex((i) => i.id === instruction.id);
      if (index === -1) return;
      const nextCollectionId = collectionId || "";
      if (nextCollectionId) {
        const collection = this.groupCollections.find((col) => col.id === nextCollectionId);
        if (!collection) return;
      }
      this.instructions[index].collectionId = nextCollectionId;
      if (this.filters.collectionId && this.filters.collectionId !== nextCollectionId) {
        this.filters.collectionId = "";
      }
      this.saveStateNow();
    },
    async deleteInstruction(instruction) {
      if (!this.canManageGroupItem(instruction)) return;
      const confirmed = window.confirm(`Удалить инструкцию «${instruction.title}»? Это действие нельзя отменить.`);
      if (!confirmed) return;
      const index = this.instructions.findIndex((i) => i.id === instruction.id);
      if (index === -1) return;
      const [removed] = this.instructions.splice(index, 1);
      this.users.forEach((user) => {
        if (Array.isArray(user.completedInstructions)) {
          user.completedInstructions = user.completedInstructions.filter((id) => id !== removed.id);
        }
        if (user.instructionResults && user.instructionResults[removed.id]) {
          delete user.instructionResults[removed.id];
        }
      });
      if (this.currentUser) {
        const freshUser = this.users.find((user) => user.id === this.currentUser.id);
        if (freshUser) {
          this.currentUser = JSON.parse(JSON.stringify(freshUser));
        }
      }
      if (this.activeInstruction && this.activeInstruction.id === removed.id) {
        const modalElement = document.getElementById("instructionModal");
        if (modalElement && window.bootstrap) {
          window.bootstrap.Modal.getOrCreateInstance(modalElement).hide();
        }
        this.activeInstruction = null;
        this.fullscreenInstructionImage = false;
        document.body.classList.remove("instruction-fullscreen-open");
      }
      await this.deleteInstructionStorageImages(removed);
      await this.saveStateNow();
    },
    async deleteInstructionStorageImages(instruction) {
      if (!supabase || !instruction || !Array.isArray(instruction.images)) return;
      const paths = instruction.images
        .map((image) => image && image.path)
        .filter(Boolean);
      if (!paths.length) return;
      try {
        const session = await this.ensureSupabaseSessionForCurrentUser();
        if (!session) return;
        const { error } = await supabase.storage.from("instruction-images").remove(paths);
        if (error) {
          console.warn("Supabase image delete failed:", error.message);
        }
      } catch (error) {
        console.warn("Supabase image delete failed:", error && error.message ? error.message : error);
      }
    },
    async deleteCollection(collection) {
      if (!this.canManageGroupItem(collection)) return;
      const total = this.collectionInstructionCount(collection.id);
      const message = total
        ? `Удалить коллекцию «${collection.name}»? ${total} инструкций останутся в списке без коллекции.`
        : `Удалить коллекцию «${collection.name}»?`;
      const confirmed = window.confirm(message);
      if (!confirmed) return;
      const index = this.collections.findIndex((col) => col.id === collection.id);
      if (index === -1) return;
      this.collections.splice(index, 1);
      this.instructions.forEach((instruction) => {
        if (instruction.collectionId === collection.id) {
          instruction.collectionId = "";
        }
      });
      if (this.instructionForm.collectionId === collection.id) {
        this.instructionForm.collectionId = "";
      }
      if (this.filters.collectionId === collection.id) {
        this.filters.collectionId = "";
      }
      await this.saveStateNow();
    },
    collectionCompletedCount(col) {
      if (!this.currentUser || !this.currentUser.completedInstructions) return 0;
      const instrIds = new Set(
        this.groupInstructions
          .filter((i) => i.collectionId === col.id)
          .map((i) => i.id)
      );
      return this.currentUser.completedInstructions.filter((id) => instrIds.has(id)).length;
    },
    collectionProgressPercent(col) {
      const total = this.collectionInstructionCount(col.id);
      if (!total) return 0;
      const done = this.collectionCompletedCount(col);
      return Math.min(100, Math.round((done / total) * 100));
    },
    isCollectionCompleted(col) {
      const total = this.collectionInstructionCount(col.id);
      if (!total) return false;
      const done = this.collectionCompletedCount(col);
      return done === total;
    },
    generateTeacherConfirmCode() {
      if (!this.currentUser || this.currentUser.role !== "admin") return;
      const index = this.users.findIndex((u) => u.id === this.currentUser.id);
      if (index === -1) return;
      const code = String(100000 + Math.floor(Math.random() * 900000));
      this.users[index].teacherConfirmCode = code;
      this.currentUser = JSON.parse(JSON.stringify(this.users[index]));
      this.saveState();
    },
    prolongUser(user, days) {
      const index = this.users.findIndex((u) => u.id === user.id);
      if (index === -1) return;
      const current = new Date(this.users[index].activeUntil || new Date());
      const updated = new Date(current.getTime() + 1000 * 60 * 60 * 24 * days);
      this.users[index].activeUntil = updated.toISOString();
      this.saveState();
      if (this.currentUser && this.currentUser.id === user.id) {
        this.currentUser = JSON.parse(JSON.stringify(this.users[index]));
      }
    },
    setUserActiveUntil(user, dateStr) {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return;
      const index = this.users.findIndex((u) => u.id === user.id);
      if (index === -1) return;
      this.users[index].activeUntil = d.toISOString();
      this.saveState();
      if (this.currentUser && this.currentUser.id === user.id) {
        this.currentUser = JSON.parse(JSON.stringify(this.users[index]));
      }
    },
    formatDateForInput(isoStr) {
      if (!isoStr) return "";
      const d = new Date(isoStr);
      if (Number.isNaN(d.getTime())) return "";
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    },
    deleteUser(user) {
      const index = this.users.findIndex((u) => u.id === user.id);
      if (index === -1) {
        return;
      }
      this.users[index].active = false;
      this.saveState();
      if (this.currentUser && this.currentUser.id === user.id) {
        this.logout();
      }
    },
    formatDate(value) {
      if (!value) return "-";
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "-";
      return date.toLocaleDateString("ru-RU");
    },
    loadState() {
      const raw = window.localStorage.getItem("robot-site-state");
      if (!raw) {
        this.seedInitialData();
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        const dropCollectionIds = new Set(["col-mini-car", "col-zoo-car", "col-halloween", "col-feb23"]);
        const isDemoInstruction = (instr) => {
          if (!instr || !instr.id) return false;
          if (dropCollectionIds.has(instr.collectionId)) return true;
          return false;
        };
        this.users = parsed.users || [];
        // Ensure new fields exist for old users
        this.users.forEach(u => {
          if (!u.completedInstructions) u.completedInstructions = [];
          if (!u.instructionResults) u.instructionResults = {};
          if (u.lastCompletedAt === undefined) u.lastCompletedAt = null;
          if (u.teacherConfirmCode === undefined) u.teacherConfirmCode = "";
          if (u.email === undefined) u.email = "";
          if (u.supabaseAuthId === undefined) u.supabaseAuthId = "";
          if (u.gender === undefined) u.gender = "";
          if (u.age === undefined) u.age = u.role === "user" ? 0 : 30;
          if (!u.createdAt && u.activeUntil) {
            const d = new Date(u.activeUntil);
            d.setDate(d.getDate() - 90);
            u.createdAt = d.toISOString();
          }
        });
        this.instructions = (parsed.instructions || []).filter((i) => !isDemoInstruction(i));
        // Нормализуем уровни сложности, чтобы у каждой инструкции была корректная сложность
        this.instructions.forEach((i) => {
          if (!i.difficulty) {
            i.difficulty = "easy";
          }
          if (i.difficulty === "advanced") {
            i.difficulty = "hard";
          }
        });

        // Если вдруг ни одна инструкция не помечена как "hard",
        // автоматически повышаем сложность у самых "навороченных" medium‑инструкций.
        let hardCount = this.instructions.filter((i) => i.difficulty === "hard").length;
        if (hardCount === 0) {
          const mediumCandidates = this.instructions.filter((i) => i.difficulty === "medium");
          mediumCandidates
            .sort((a, b) => {
              const score = (x) => {
                const slides = Number(x.slidesCount || x.slides || 0);
                const complex = Number(x.complexConnectionsCount || x.complexConnections || 0);
                const prog = Number(x.programComplexity || 0);
                const motor = x.hasMotor ? 1 : 0;
                const sensors = x.hasSensors ? 1 : 0;
                return slides + complex * 2 + prog * 3 + motor * 2 + sensors * 3;
              };
              return score(b) - score(a);
            })
            .slice(0, 6)
            .forEach((i) => {
              i.difficulty = "hard";
            });
        }
        this.collections = (parsed.collections || []).filter((c) => !dropCollectionIds.has(c.id));
        this.collections.forEach((c) => {
          if (!c.groupId) c.groupId = "group-1";
        });
        this.instructions.forEach((i) => {
          if (!i.groupId) i.groupId = "group-1";
        });
        if (Array.isArray(parsed.groups) && parsed.groups.length > 0) {
          this.groups = parsed.groups;
        }
      } catch {
        this.seedInitialData();
      }
    },
    saveState() {
      const payload = this.statePayload();
      window.localStorage.setItem("robot-site-state", JSON.stringify(payload));
      this.queueBackendSave(payload);
    },
    dedupeData() {
      const nameKey = (s) => String(s || "").trim().toLowerCase();
      const colKeepByName = new Map();
      const replaceId = new Map();
      for (const col of this.collections) {
        const key = nameKey(col.name);
        if (!key) continue;
        if (!colKeepByName.has(key)) {
          colKeepByName.set(key, col.id);
        } else {
          const keepId = colKeepByName.get(key);
          if (keepId !== col.id) {
            replaceId.set(col.id, keepId);
          }
        }
      }
      if (replaceId.size > 0) {
        this.instructions = this.instructions.map((i) => {
          const rep = replaceId.get(i.collectionId);
          if (rep) {
            return Object.assign({}, i, { collectionId: rep });
          }
          return i;
        });
        this.collections = this.collections.filter((c) => !replaceId.has(c.id));
      }
      const colIdToName = new Map(this.collections.map((c) => [c.id, c.name]));
      const groups = new Map();
      const score = (i) => {
        let s = 0;
        if (i && i.imageUrl && String(i.imageUrl).trim()) s += 10;
        if (i && i.imageUrl && String(i.imageUrl).includes("/Projectlego/img/")) s += 2;
        if (Array.isArray(i.steps) && i.steps.length > 0) s += 1;
        return s;
      };
      for (const instr of this.instructions) {
        const t = nameKey(instr.title);
        const cn = nameKey(colIdToName.get(instr.collectionId) || "");
        const k = t + "|" + cn;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(instr);
      }
      const keepIds = new Set();
      for (const arr of groups.values()) {
        if (arr.length === 1) {
          keepIds.add(arr[0].id);
          continue;
        }
        const sorted = arr.slice().sort((a, b) => score(b) - score(a));
        keepIds.add(sorted[0].id);
      }
      if (keepIds.size > 0) {
        this.instructions = this.instructions.filter((i) => keepIds.has(i.id));
      }
    },
    seedProjectlegoStatic() {
      const gid = "group-1";
      const ensureCollection = (id, name) => {
        const existing = this.collections.find((c) => c.id === id && (c.groupId || "group-1") === gid);
        if (!existing) {
          this.collections.push({ id, name, groupId: gid });
        } else {
          if (existing.name !== name) existing.name = name;
          if (!existing.groupId) existing.groupId = gid;
        }
      };
      const addInstruction = (instr) => {
        const withGroup = Object.assign({}, instr, { groupId: instr.groupId || gid });
        const idx = this.instructions.findIndex((i) => i.id === instr.id);
        if (idx === -1) {
          this.instructions.push(withGroup);
        } else {
          this.instructions[idx] = Object.assign({}, this.instructions[idx], withGroup);
        }
      };
      ensureCollection("col-pl-avto-mini", "Avto Mini");
      ensureCollection("col-pl-dino-park", "Dino Park");
      ensureCollection("col-pl-space-journey", "Space Journey");
      ensureCollection("col-pl-zoo-park", "Zoo Park");
      ensureCollection("col-pl-zoo-mini", "Zoo Mini");
      ensureCollection("col-pl-star-wars", "Star Wars");
      ensureCollection("col-pl-singles", "Projectlego: Инструкции");
      const easy = 12, med = 18;
      const mk = (id, title, cats, col, img, diff, motor = false, sensors = false, format = "pdf") => ({
        id, title, categories: cats, collectionId: col, groupId: gid,
        slidesCount: diff === "easy" ? easy : med,
        complexConnectionsCount: diff === "easy" ? 2 : 4,
        programComplexity: diff === "easy" ? 2 : 3,
        selfAssemblyBonus: true,
        selfProgrammingBonus: false,
        fixMalfunctionBonus: false,
        difficulty: diff,
        imageUrl: img,
        description: "",
        steps: [],
        hasMotor: motor,
        hasSensors: sensors,
        format: format,
      });
      const p = (name) => "/Projectlego/img/complect/" + name;
      [
        mk("pl-avto-mini-betmobil", "Бетмобиль", ["транспорт"], "col-pl-avto-mini", p("betmobil_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-velosiped", "Велосипед", ["транспорт"], "col-pl-avto-mini", p("velosiped_mini.PNG"), "easy", false, false, "pdf"),
        mk("pl-avto-mini-dzhip", "Джип", ["транспорт"], "col-pl-avto-mini", p("dzhip_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-mototsikl", "Мотоцикл", ["транспорт"], "col-pl-avto-mini", p("mototsikl_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-retromobil", "Ретромобиль", ["транспорт"], "col-pl-avto-mini", p("retromobil_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-scooter", "Скутер", ["транспорт"], "col-pl-avto-mini", p("scooter_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-traktor", "Трактор", ["транспорт"], "col-pl-avto-mini", p("traktor_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-tricikl", "Трицикл", ["транспорт"], "col-pl-avto-mini", p("tritsikl_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-avto-mini-chopper", "Чопер", ["транспорт"], "col-pl-avto-mini", p("chopper_mini.PNG"), "easy", true, false, "pdf"),
        mk("pl-dino-arthropleura", "Артроплевра", ["динозавры", "животные"], "col-pl-dino-park", p("arthropleura.jpg"), "medium", true, true, "video"),
        mk("pl-dino-golova", "Голова дино", ["динозавры", "животные"], "col-pl-dino-park", p("golova2.jpg"), "medium", false, false, "pdf"),
        mk("pl-dino-dimetrodon", "Диметродон", ["динозавры", "животные"], "col-pl-dino-park", p("dimetrodon.jpg"), "medium", true, true, "video"),
        mk("pl-dino-zavropod", "Завропод", ["динозавры", "животные"], "col-pl-dino-park", p("zavropod.jpg"), "medium", true, false, "pdf"),
        mk("pl-dino-megalodon", "Мегалодон", ["динозавры", "животные"], "col-pl-dino-park", p("megalodon.jpg"), "medium", true, false, "pdf"),
        mk("pl-dino-meiolaniya", "Миолания", ["динозавры", "животные"], "col-pl-dino-park", p("meiolaniya.jpg"), "medium", true, true, "pdf"),
        mk("pl-dino-mosasaur", "Мозазавр", ["динозавры", "животные"], "col-pl-dino-park", p("mosasaur.jpg"), "medium", true, false, "pdf"),
        mk("pl-dino-parazaurolof", "Паразауролоф", ["динозавры", "животные"], "col-pl-dino-park", p("parazaurolof.jpg"), "medium", true, true, "pdf"),
        mk("pl-dino-pleziozavr", "Плезиозавр", ["динозавры", "животные"], "col-pl-dino-park", p("pleziozavr.jpg"), "medium", true, false, "pdf"),
        mk("pl-dino-pterodon", "Птеродон", ["динозавры", "животные"], "col-pl-dino-park", p("pterodon.jpg"), "medium", true, true, "pdf"),
        mk("pl-dino-stegosaur", "Стегозавр", ["динозавры", "животные"], "col-pl-dino-park", p("stegosaur.jpg"), "medium", true, true, "pdf"),
        mk("pl-dino-tirannozaur", "Тираннозавр", ["динозавры", "животные"], "col-pl-dino-park", p("tirannozaur.jpg"), "medium", true, true, "video"),
        mk("pl-dino-triceratops", "Трицератопс", ["динозавры", "животные"], "col-pl-dino-park", p("triceratops.jpg"), "medium", true, true, "pdf"),
        mk("pl-space-inoplanetyanin", "Инопланетянин", ["космос", "тематические"], "col-pl-space-journey", p("inoplanetyanin.jpg"), "medium", true, true, "pdf"),
        mk("pl-space-scaut", "Скаут", ["космос", "тематические"], "col-pl-space-journey", p("scaut.jpg"), "medium", true, false, "pdf"),
        mk("pl-star-xving", "Звездолёт X-VING", ["космос", "тематические"], "col-pl-star-wars", p("xving.png"), "medium", true, false, "pdf"),
        mk("pl-star-battle", "Космическая битва", ["космос", "тематические"], "col-pl-star-wars", p("cosmoswar.jpg"), "medium", true, false, "pdf"),
        mk("pl-star-r2d2", "R2D2", ["космос", "тематические"], "col-pl-star-wars", p("r2d2.png"), "medium", true, true, "pdf"),
        mk("pl-zoo-bogomol", "Богомол", ["животные"], "col-pl-zoo-park", p("bogomol.jpg"), "medium", true, true, "pdf"),
        mk("pl-zoo-muha", "Муха", ["животные"], "col-pl-zoo-park", p("muha.jpg"), "medium", true, false, "pdf"),
        mk("pl-zoo-mini-shark", "Акула", ["животные"], "col-pl-zoo-mini", p("shark.png"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-butterfly", "Бабочка", ["животные"], "col-pl-zoo-mini", p("butterfly-mini.png"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-byk", "Бык", ["животные"], "col-pl-zoo-mini", p("byk.PNG"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-cat", "Кошка", ["животные"], "col-pl-zoo-mini", p("cat.png"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-kroko", "Крокодил", ["животные"], "col-pl-zoo-mini", p("kroko.png"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-forse", "Лошадка", ["животные"], "col-pl-zoo-mini", p("forse.PNG"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-muha", "Муха", ["животные"], "col-pl-zoo-mini", p("muha.jpg"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-monkey", "Обезьянка", ["животные"], "col-pl-zoo-mini", p("monkey.png"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-octopus", "Осьминог", ["животные"], "col-pl-zoo-mini", p("octopus-mini.png"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-panda", "Панда", ["животные"], "col-pl-zoo-mini", p("panda.png"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-spider", "Паук", ["животные"], "col-pl-zoo-mini", p("spider.png"), "easy", true, true, "pdf"),
        mk("pl-zoo-mini-parakeet", "Попугай", ["животные"], "col-pl-zoo-mini", p("parakeet.png"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-bee", "Пчела", ["животные"], "col-pl-zoo-mini", p("bee.png"), "easy", true, true, "pdf"),
        mk("pl-zoo-mini-fish", "Рыбка", ["животные"], "col-pl-zoo-mini", p("fish.PNG"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-dog", "Собака", ["животные"], "col-pl-zoo-mini", p("dog.png"), "easy", true, false, "pdf"),
        mk("pl-zoo-mini-owl", "Сова", ["животные"], "col-pl-zoo-mini", p("owl.PNG"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-dragonfly", "Стрекоза", ["животные"], "col-pl-zoo-mini", p("dragonfly.PNG"), "easy", true, true, "pdf"),
        mk("pl-zoo-mini-snail", "Улитка", ["животные"], "col-pl-zoo-mini", p("snail.png"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-duck", "Утка", ["животные"], "col-pl-zoo-mini", p("duck.PNG"), "easy", false, false, "pdf"),
        mk("pl-zoo-mini-tortila", "Черепашка", ["животные"], "col-pl-zoo-mini", p("tortila.png"), "easy", true, false, "pdf"),
        mk("pl-single-walle", "WALL-E", ["тематические"], "col-pl-singles", "/Projectlego/img/wally.PNG", "medium", true, true, "pdf"),
        mk("pl-single-tesla", "Tesla", ["тематические"], "col-pl-singles", "/Projectlego/img/tesla.png", "medium", true, false, "pdf"),
        mk("pl-single-catmouse", "Кот и мышка", ["тематические"], "col-pl-singles", "/Projectlego/img/complect/cat.png", "medium", true, true, "pdf"),
        mk("pl-single-tortila", "Черепашка", ["тематические"], "col-pl-singles", "/Projectlego/img/tortila.png", "medium", true, false, "pdf"),
      ].forEach(addInstruction);
      this.dedupeData();
      this.saveState();
    },
    async importProjectlego() {
      let importedAny = false;
      const gid = "group-1";
      try {
        const base = "/Projectlego/";
        const resp = await fetch(base + "index.html");
        if (!resp.ok) {
          return;
        }
        const text = await resp.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, "text/html");
        const pageLinks = Array.from(doc.querySelectorAll('a.complect__card[href^="pages/complect/"]'))
          .map((a) => a.getAttribute("href"))
          .filter(Boolean);
        const uniquePages = Array.from(new Set(pageLinks));
        const nameToCategories = (name) => {
          const n = (name || "").toLowerCase();
          if (n.includes("avto") || n.includes("auto")) return ["транспорт"];
          if (n.includes("dino")) return ["динозавры", "животные"];
          if (n.includes("zoo")) return ["животные"];
          if (n.includes("space")) return ["космос", "тематические"];
          if (n.includes("star")) return ["космос", "тематические"];
          return ["тематические"];
        };
        const slug = (s) =>
          String(s || "")
            .toLowerCase()
            .replace(/[^a-zA-ZА-Яа-я0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
        const ensureCollection = (name) => {
          const id = "col-pl-" + slug(name);
          if (!this.collections.find((c) => c.id === id && (c.groupId || "group-1") === gid)) {
            this.collections.push({ id, name, groupId: gid });
          }
          return id;
        };
        const addInstructionSafe = (instr) => {
          if (!this.instructions.find((i) => i.id === instr.id)) {
            this.instructions.push(instr);
            importedAny = true;
          }
        };
        for (const relPath of uniquePages) {
          const cleanedPath = relPath && relPath[0] === "/" ? relPath.slice(1) : relPath;
          const pagePath = base + cleanedPath;
          const r = await fetch(pagePath);
          if (!r.ok) continue;
          const html = await r.text();
          const d = parser.parseFromString(html, "text/html");
          const titleEl = d.querySelector("h2.title_h2");
          const collectionName = (titleEl && titleEl.textContent.trim()) || "Projectlego";
          const collectionId = ensureCollection(collectionName);
          const cards = Array.from(d.querySelectorAll(".complect__card"));
          for (const card of cards) {
            const imgEl = card.querySelector("img");
            const h3El = card.querySelector("h3");
            const title = (h3El && h3El.textContent.trim()) || "Без названия";
            const rawSrc = imgEl ? imgEl.getAttribute("src") : "";
            let imageUrl = "";
            try {
              imageUrl = new URL(rawSrc, pagePath).pathname;
            } catch {
              imageUrl = "";
            }
            const cats = nameToCategories(collectionName);
            const n = collectionName.toLowerCase();
            let difficulty = "easy";
            if (n.includes("mini") || n.includes("zoo")) difficulty = "easy";
            if (n.includes("avto") || n.includes("dino")) difficulty = "medium";
            if (n.includes("star") || n.includes("space")) difficulty = "medium";
            const slidesCount = difficulty === "easy" ? 12 : 18;
            const id = "pl-" + slug(collectionName) + "-" + slug(title);
            addInstructionSafe({
              id,
              title,
              categories: cats,
              collectionId,
              groupId: gid,
              slidesCount,
              complexConnectionsCount: difficulty === "easy" ? 2 : 4,
              programComplexity: difficulty === "easy" ? 2 : 3,
              selfAssemblyBonus: true,
              selfProgrammingBonus: false,
              fixMalfunctionBonus: false,
              difficulty,
              imageUrl,
              description: "",
              steps: [],
              hasMotor: n.includes("avto") || n.includes("star") || n.includes("dino"),
              hasSensors: n.includes("star") || n.includes("dino"),
              format: n.includes("dino") ? "video" : "pdf",
            });
          }
        }
        const h2s = Array.from(doc.querySelectorAll("h2.title_h2"));
        const h2Instr = h2s.find((el) => (el.textContent || "").trim().toLowerCase().includes("инструкции"));
        if (h2Instr) {
          let container = h2Instr.nextElementSibling;
          // Find nearest .complect__wrapper after the h2
          while (container && !container.classList.contains("complect__wrapper")) {
            container = container.nextElementSibling;
          }
          if (container) {
            const singleColId = ensureCollection("Projectlego: Инструкции");
            const cards = Array.from(container.querySelectorAll(".complect__card"));
            for (const card of cards) {
              const imgEl = card.querySelector("img");
              const h3El = card.querySelector("h3");
              const title = (h3El && h3El.textContent.trim()) || "Инструкция";
              const rawSrc = imgEl ? imgEl.getAttribute("src") : "";
              let imageUrl = "";
              try {
                imageUrl = new URL(rawSrc, base + "index.html").pathname;
              } catch {
                imageUrl = "";
              }
              const hasExt = (p) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(String(p || ""));
              if (!hasExt(imageUrl)) {
                const t = String(title || "").toLowerCase();
                if (t.includes("кот") && t.includes("мыш")) {
                  imageUrl = "/Projectlego/img/complect/cat.png";
                }
              }
              const id = "pl-single-" + slug(title);
              const tLow = title.toLowerCase();
              addInstructionSafe({
                id,
                title,
                categories: ["тематические"],
                collectionId: singleColId,
                slidesCount: 16,
                complexConnectionsCount: 3,
                programComplexity: 3,
                selfAssemblyBonus: true,
                selfProgrammingBonus: false,
                fixMalfunctionBonus: false,
                difficulty: "medium",
                imageUrl,
                description: "",
                steps: [],
                hasMotor: true,
                hasSensors: tLow.includes("робот") || tLow.includes("датчик"),
                format: "pdf",
              });
            }
          }
        }
      } catch (e) {
        console.warn("Projectlego import failed", e);
      } finally {
        this.dedupeData();
        if (importedAny) {
          this.saveState();
          window.localStorage.setItem("pl-imported-v1", "yes");
        } else {
          window.localStorage.removeItem("pl-imported-v1");
        }
      }
    },
    runImportNow() {
      try {
        window.localStorage.removeItem("pl-imported-v1");
      } catch {}
      this.importProjectlego();
    },
    hasProjectlegoStatic() {
      return this.instructions.some((instruction) => (
        String(instruction.id || "").startsWith("pl-") &&
        (instruction.groupId || "group-1") === "group-1"
      ));
    },
    seedInitialData() {
      const now = new Date();
      const long = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365);
      this.groups = [
        {
          id: "group-1",
          code: "1234",
          name: "Мобильная робототехника и программирование роботов",
          teacherName: "Иванов Иван Иванович",
        },
      ];
      this.users = [
        {
          id: "user-demo",
          name: "Демонстрационный Ученик Тестович",
          login: "user",
          password: "user",
          role: "user",
          groupId: "group-1",
          exp: 0,
          completedInstructions: [],
          instructionResults: {},
          teacherConfirmCode: "",
          lastCompletedAt: null,
          active: true,
          activeUntil: long.toISOString(),
          createdAt: now.toISOString(),
          gender: "male",
          age: 9,
        },
        {
          id: "admin-demo",
          name: "Иванов Иван Иванович",
          login: "admin",
          password: "admin",
          role: "admin",
          groupId: "group-1",
          exp: 0,
          completedInstructions: [],
          instructionResults: {},
          teacherConfirmCode: "",
          lastCompletedAt: null,
          active: true,
          activeUntil: long.toISOString(),
          createdAt: now.toISOString(),
          age: 35,
        },
        {
          id: "moderator-demo",
          name: "Создатель сайта",
          login: "moderator",
          password: "moderator",
          role: "moderator",
          groupId: "group-1",
          exp: 0,
          completedInstructions: [],
          instructionResults: {},
          teacherConfirmCode: "",
          lastCompletedAt: null,
          active: true,
          activeUntil: long.toISOString(),
          createdAt: now.toISOString(),
          age: 30,
        },
      ];
      this.collections = [];
      this.instructions = [];
      if (!this.groups || this.groups.length === 0) {
        this.groups = [
          { id: "group-1", code: "1234", name: "Мобильная робототехника и программирование роботов", teacherName: "Иванов Иван Иванович" },
        ];
      }
      this.saveState();
    },
    async checkSupabaseConnection() {
      if (!supabase) {
        console.warn("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.");
        return;
      }

      const { error } = await supabase.auth.getSession();
      if (error) {
        console.warn("Supabase connection check failed:", error.message);
        return;
      }

      console.info("Supabase connection is ready.");
    },
  },
  mounted() {
    this.loadState();
    if (!this.hasProjectlegoStatic()) {
      this.seedProjectlegoStatic();
    }
    this.checkSupabaseConnection();
    const savedTheme = window.localStorage.getItem("site-theme");
    if (savedTheme === "dark" || savedTheme === "light") {
      this.theme = savedTheme;
    }
    this.applyTheme();
    this.loadStateFromSupabase();
    this._clickOutsideHandler = (e) => {
      const target = e.target;
      if (!target.closest || !target.closest(".pretty-select")) {
        this.closeAllSelects();
      }
    };
    window.addEventListener("click", this._clickOutsideHandler);
  },
  unmounted() {
    if (this._clickOutsideHandler) {
      window.removeEventListener("click", this._clickOutsideHandler);
    }
    if (this.backendSaveTimer) {
      window.clearTimeout(this.backendSaveTimer);
    }
  },
};

Vue.createApp(App).mount("#app");
