ALTER TABLE diagnoses ADD COLUMN expected_answer TEXT;
ALTER TABLE diagnoses ADD COLUMN warnings TEXT;

CREATE INDEX IF NOT EXISTS idx_diagnoses_created_at ON diagnoses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_knowledge_point ON evidence(knowledge_point, created_at DESC);
