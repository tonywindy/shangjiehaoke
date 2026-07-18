PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS teachers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS classes (
  id TEXT PRIMARY KEY,
  teacher_id TEXT NOT NULL,
  name TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT 'grade-3',
  school_year TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  class_id TEXT NOT NULL,
  anonymous_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  UNIQUE (class_id, anonymous_code)
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('pre_test', 'wrong_answer', 'learning_work', 'post_test')),
  knowledge_point TEXT NOT NULL,
  object_key TEXT,
  original_filename TEXT,
  mime_type TEXT,
  file_size INTEGER,
  retention_until TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id TEXT PRIMARY KEY,
  evidence_id TEXT NOT NULL,
  recognized_answer TEXT,
  ai_error_type TEXT,
  ai_possible_cause TEXT,
  ai_learning_need TEXT,
  ai_confidence REAL,
  teacher_error_type TEXT,
  teacher_possible_cause TEXT,
  teacher_learning_need TEXT,
  teacher_confirmed_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  model_provider TEXT,
  model_name TEXT,
  prompt_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS student_profiles (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  diagnosis_id TEXT NOT NULL,
  knowledge_point TEXT NOT NULL,
  current_layer TEXT NOT NULL CHECK (current_layer IN ('support', 'consolidation', 'exploration')),
  strengths TEXT,
  challenges TEXT,
  learning_needs TEXT,
  teacher_confirmed_layer TEXT CHECK (teacher_confirmed_layer IN ('support', 'consolidation', 'exploration')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (diagnosis_id) REFERENCES diagnoses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS layered_tasks (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  layer TEXT NOT NULL CHECK (layer IN ('support', 'consolidation', 'exploration')),
  title TEXT NOT NULL,
  task_content TEXT NOT NULL,
  task_goal TEXT,
  estimated_minutes INTEGER,
  selected_by_teacher INTEGER NOT NULL DEFAULT 0 CHECK (selected_by_teacher IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  post_evidence_id TEXT,
  concept_understanding_before INTEGER CHECK (concept_understanding_before BETWEEN 0 AND 100),
  concept_understanding_after INTEGER CHECK (concept_understanding_after BETWEEN 0 AND 100),
  reasoning_expression_before INTEGER CHECK (reasoning_expression_before BETWEEN 0 AND 100),
  reasoning_expression_after INTEGER CHECK (reasoning_expression_after BETWEEN 0 AND 100),
  problem_solving_before INTEGER CHECK (problem_solving_before BETWEEN 0 AND 100),
  problem_solving_after INTEGER CHECK (problem_solving_after BETWEEN 0 AND 100),
  error_correction_before INTEGER CHECK (error_correction_before BETWEEN 0 AND 100),
  error_correction_after INTEGER CHECK (error_correction_after BETWEEN 0 AND 100),
  solved_summary TEXT,
  remaining_summary TEXT,
  teaching_suggestions TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (profile_id) REFERENCES student_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (post_evidence_id) REFERENCES evidence(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  teacher_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_evidence_student ON evidence(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diagnoses_evidence ON diagnoses(evidence_id);
CREATE INDEX IF NOT EXISTS idx_profiles_student ON student_profiles(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_profile ON layered_tasks(profile_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON evaluations(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
