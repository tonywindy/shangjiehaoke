CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_diagnosis_unique
  ON student_profiles(diagnosis_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_profile_layer_unique
  ON layered_tasks(profile_id, layer);
