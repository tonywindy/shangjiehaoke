import { useCallback, useEffect, useRef, useState } from 'react';

const KNOWLEDGE_OPTIONS = [
  { value: 'perimeter-concept', label: '周长的认识' },
  { value: 'rectangle', label: '长方形周长' },
  { value: 'square', label: '正方形周长' },
  { value: 'combined', label: '组合图形边界' },
  { value: 'application', label: '周长实际问题' },
];

const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || 'https://api.shangjiehaoke.com';

const apiFetch = (path, options = {}) => fetch(`${AI_API_BASE_URL}${path}`, {
  credentials: 'include',
  ...options,
});

const DEMO_DIAGNOSIS = {
  recognizedAnswer: '8 + 5 = 13',
  expectedAnswer: '（8 + 5）× 2 = 26（米）',
  errorType: '周长概念理解不完整',
  possibleCause: '只计算了相邻两条边，尚未形成“封闭图形一周长度”的完整表象。',
  learningNeed: '建立“封闭一周”表象，理解四条边关系',
  confidence: 0.96,
  warnings: [],
};

const WORKFLOW = [
  {
    id: 'diagnosis',
    number: '01',
    stage: '智能诊断',
    caption: '多源采集 · 人机析因',
    status: '进行中',
  },
  {
    id: 'layering',
    number: '02',
    stage: '动态分层',
    caption: '画像分层 · 精准干预',
    status: '待开始',
  },
  {
    id: 'evaluation',
    number: '03',
    stage: '多元评价',
    caption: '多维评学 · 反馈迭代',
    status: '待开始',
  },
];

const Icon = ({ name, size = 20 }) => {
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></>,
    spark: <><path d="m12 3 1.4 4.1a2.4 2.4 0 0 0 1.5 1.5L19 10l-4.1 1.4a2.4 2.4 0 0 0-1.5 1.5L12 17l-1.4-4.1a2.4 2.4 0 0 0-1.5-1.5L5 10l4.1-1.4a2.4 2.4 0 0 0 1.5-1.5L12 3Z"/><path d="m19 3 .5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3Z"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>,
    chart: <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    school: <><path d="m3 10 9-6 9 6-9 6-9-6Z"/><path d="M7 13v5c3 2 7 2 10 0v-5M21 10v6"/></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('ganlaoshi');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '登录失败');
      setPassword('');
      onLogin(payload.teacher);
    } catch (loginError) {
      setStatus('error');
      setError(loginError.message || '登录失败，请稍后重试');
      return;
    }
    setStatus('idle');
  };

  return (
    <main className="login-shell">
      <section className="login-story">
        <a className="login-brand" href="/">
          <span className="brand-mark"><span>π</span></span>
          <span><strong>上节好课</strong><small>AI 精准教学</small></span>
        </a>
        <div className="login-story-copy">
          <span className="eyebrow"><Icon name="spark" size={15} /> 教师专属工作台</span>
          <h1>看见每一次错误，<br />也看见成长的方向。</h1>
          <p>从学生作品出发，完成诊断、分层与评价。AI 提供建议，教师保留最终判断。</p>
        </div>
        <div className="login-proof">
          <span><Icon name="shield" size={17} /> 教师账号保护</span>
          <span><Icon name="file" size={17} /> 诊断记录可追溯</span>
          <span><Icon name="lock" size={17} /> 原始图片不留存</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="login-card-index">01 / TEACHER ACCESS</span>
          <h2>教师登录</h2>
          <p>登录后才能使用 AI 诊断额度，并查看自己的历史记录。</p>
          <label>
            <span>教师账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入教师账号" required />
          </label>
          <label>
            <span>密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" required />
          </label>
          {error && <div className="login-error"><Icon name="info" size={15} /> {error}</div>}
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '正在验证…' : '进入教师工作台'}
            {status !== 'loading' && <Icon name="arrow" size={18} />}
          </button>
          <small><Icon name="shield" size={13} /> 登录状态采用安全 Cookie 保存，密码不会存入浏览器。</small>
        </form>
      </section>
    </main>
  );
};

const HistoryDrawer = ({ open, onClose, onAuthExpired, onOpenProfile }) => {
  const [status, setStatus] = useState('idle');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState('');
  const [openingId, setOpeningId] = useState('');

  const handleOpenProfile = async (diagnosisId) => {
    setOpeningId(diagnosisId);
    setError('');
    try {
      const response = await apiFetch(`/api/diagnoses/${encodeURIComponent(diagnosisId)}/layering`, { method: 'POST' });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效');
      }
      if (!response.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.error?.message || '学习画像打开失败');
      }
      onOpenProfile(payload.profile);
    } catch (profileError) {
      setError(profileError.message || '学习画像打开失败');
      setStatus('error');
    } finally {
      setOpeningId('');
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    apiFetch('/api/diagnoses?limit=30', { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          onAuthExpired();
          throw new Error('登录状态已失效');
        }
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '记录加载失败');
        setDiagnoses(payload.diagnoses || []);
        setStatus('ready');
      })
      .catch((historyError) => {
        if (historyError.name === 'AbortError') return;
        setError(historyError.message || '记录加载失败');
        setStatus('error');
      });
    return () => controller.abort();
  }, [open, onAuthExpired]);

  if (!open) return null;
  return (
    <div className="history-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="history-drawer" role="dialog" aria-modal="true" aria-label="诊断历史记录">
        <div className="history-heading">
          <div><span>TEACHING ARCHIVE</span><h2>诊断记录</h2><p>这里只保存文字诊断，不保存学生原始图片。</p></div>
          <button onClick={onClose} aria-label="关闭历史记录"><Icon name="close" size={20} /></button>
        </div>
        {status === 'loading' && <div className="history-empty">正在读取诊断记录…</div>}
        {status === 'error' && <div className="history-empty is-error">{error}</div>}
        {status === 'ready' && diagnoses.length === 0 && <div className="history-empty">还没有诊断记录，上传第一份学生作品后会自动出现在这里。</div>}
        {status === 'ready' && diagnoses.length > 0 && (
          <div className="history-list">
            {diagnoses.map((item) => (
              <article className="history-item" key={item.id}>
                <div className="history-item-top">
                  <span className="history-student">学生 {item.studentCode}</span>
                  <span className={`history-status is-${item.status}`}>{item.status === 'confirmed' ? '教师已确认' : '待确认'}</span>
                </div>
                <h3>{item.errorType || '等待诊断'}</h3>
                <p>{item.possibleCause || '暂无原因说明'}</p>
                <div className="history-item-footer"><span>{item.className || '默认班级'} · {KNOWLEDGE_OPTIONS.find((option) => option.value === item.knowledgePoint)?.label || item.knowledgePoint}</span><time>{new Date(`${item.createdAt.replace(' ', 'T')}Z`).toLocaleString('zh-CN', { hour12: false })}</time>{item.status === 'confirmed' && <button onClick={() => handleOpenProfile(item.id)} disabled={Boolean(openingId)}>{openingId === item.id ? '生成中…' : '生成 / 查看画像'}</button>}</div>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
};

const ClassManagerDrawer = ({
  open,
  onClose,
  classes,
  selectedClassId,
  onSelectClass,
  onRefresh,
  onAuthExpired,
}) => {
  const [activeClassId, setActiveClassId] = useState('');
  const [newClassName, setNewClassName] = useState('');
  const [renameName, setRenameName] = useState('');
  const [studentCodes, setStudentCodes] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const activeClass = classes.find((item) => item.id === activeClassId) || classes[0];

  useEffect(() => {
    if (!open) return;
    setActiveClassId((current) => (
      classes.some((item) => item.id === current)
        ? current
        : selectedClassId || classes[0]?.id || ''
    ));
  }, [open, classes, selectedClassId]);

  useEffect(() => {
    setRenameName(activeClass?.name || '');
  }, [activeClass?.name]);

  const sendMutation = async (path, options) => {
    const response = await apiFetch(path, options);
    const payload = await response.json();
    if (response.status === 401) {
      onAuthExpired();
      throw new Error('登录状态已失效，请重新登录');
    }
    if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '保存失败');
    return payload;
  };

  const handleCreateClass = async (event) => {
    event.preventDefault();
    if (!newClassName.trim()) return;
    setStatus('loading');
    setError('');
    setMessage('');
    try {
      const payload = await sendMutation('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim() }),
      });
      setNewClassName('');
      setActiveClassId(payload.classId);
      onSelectClass(payload.classId);
      await onRefresh();
      setMessage('新班级已创建');
    } catch (mutationError) {
      setError(mutationError.message || '班级创建失败');
    } finally {
      setStatus('idle');
    }
  };

  const handleRenameClass = async (event) => {
    event.preventDefault();
    if (!activeClass || !renameName.trim() || renameName.trim() === activeClass.name) return;
    setStatus('loading');
    setError('');
    setMessage('');
    try {
      await sendMutation(`/api/classes/${encodeURIComponent(activeClass.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameName.trim() }),
      });
      await onRefresh();
      setMessage('班级名称已保存');
    } catch (mutationError) {
      setError(mutationError.message || '班级修改失败');
    } finally {
      setStatus('idle');
    }
  };

  const handleAddStudents = async (event) => {
    event.preventDefault();
    if (!activeClass) return;
    const codes = [...new Set(studentCodes.split(/[\s,，、;；]+/).map((item) => item.trim()).filter(Boolean))];
    if (!codes.length) {
      setError('请至少输入一个学生编号');
      return;
    }
    setStatus('loading');
    setError('');
    setMessage('');
    try {
      const payload = await sendMutation(`/api/classes/${encodeURIComponent(activeClass.id)}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codes }),
      });
      setStudentCodes('');
      await onRefresh();
      setMessage(`已加入 ${payload.added} 个学生编号`);
    } catch (mutationError) {
      setError(mutationError.message || '学生编号添加失败');
    } finally {
      setStatus('idle');
    }
  };

  const handleArchiveStudent = async (studentId) => {
    setStatus('loading');
    setError('');
    setMessage('');
    try {
      await sendMutation(`/api/students/${encodeURIComponent(studentId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      });
      await onRefresh();
      setMessage('学生编号已移出当前名单，历史诊断仍会保留');
    } catch (mutationError) {
      setError(mutationError.message || '学生状态修改失败');
    } finally {
      setStatus('idle');
    }
  };

  if (!open) return null;
  return (
    <div className="history-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="class-drawer" role="dialog" aria-modal="true" aria-label="班级与学生管理">
        <div className="history-heading">
          <div><span>CLASS ROSTER</span><h2>班级与学生</h2><p>仅使用匿名编号，避免录入学生真实姓名。</p></div>
          <button onClick={onClose} aria-label="关闭班级管理"><Icon name="close" size={20} /></button>
        </div>

        <form className="class-create-form" onSubmit={handleCreateClass}>
          <label><span>新建班级</span><input value={newClassName} onChange={(event) => setNewClassName(event.target.value.slice(0, 40))} placeholder="例如：三年级1班" /></label>
          <button type="submit" disabled={status === 'loading' || !newClassName.trim()}><Icon name="plus" size={16} /> 添加班级</button>
        </form>

        <div className="class-tabs" aria-label="班级列表">
          {classes.map((item) => (
            <button
              key={item.id}
              className={item.id === activeClass?.id ? 'is-active' : ''}
              onClick={() => { setActiveClassId(item.id); onSelectClass(item.id); setMessage(''); setError(''); }}
            >
              <span><Icon name="school" size={15} /> {item.name}</span>
              <small>{item.students.length} 人 · {item.diagnosisCount || 0} 条诊断</small>
            </button>
          ))}
        </div>

        {activeClass && (
          <div className="class-detail">
            <form className="class-rename-form" onSubmit={handleRenameClass}>
              <label><span>当前班级名称</span><input value={renameName} onChange={(event) => setRenameName(event.target.value.slice(0, 40))} /></label>
              <button type="submit" disabled={status === 'loading' || !renameName.trim() || renameName.trim() === activeClass.name}>保存名称</button>
            </form>

            <form className="student-batch-form" onSubmit={handleAddStudents}>
              <label><span>批量添加匿名编号</span><textarea value={studentCodes} onChange={(event) => setStudentCodes(event.target.value)} placeholder={'例如：\n01、02、03\n也可以从表格中复制一列编号'} /></label>
              <div><small>支持换行、空格、逗号或顿号分隔，一次最多60个。</small><button type="submit" disabled={status === 'loading'}><Icon name="plus" size={15} /> 加入名单</button></div>
            </form>

            <div className="student-roster-heading"><strong>当前学生名单</strong><span>{activeClass.students.length} 人</span></div>
            {activeClass.students.length ? (
              <div className="student-roster">
                {activeClass.students.map((student) => (
                  <div key={student.id}><span>{student.anonymousCode}</span><small>{student.diagnosisCount || 0} 条诊断</small><button onClick={() => handleArchiveStudent(student.id)} disabled={status === 'loading'}>移出</button></div>
                ))}
              </div>
            ) : <div className="history-empty">这个班级还没有学生编号，请在上方批量添加。</div>}
          </div>
        )}
        {message && <div className="roster-message is-success"><Icon name="check" size={15} /> {message}</div>}
        {error && <div className="roster-message is-error"><Icon name="info" size={15} /> {error}</div>}
      </aside>
    </div>
  );
};

const CurriculumSelector = ({ knowledge, setKnowledge }) => (
  <div className="curriculum-selector" aria-label="教学内容选择">
    <label className="curriculum-field is-locked">
      <span>年级</span>
      <select value="grade-3" disabled aria-label="年级">
        <option value="grade-3">三年级</option>
      </select>
      <small><Icon name="lock" size={12} /> V1开放</small>
    </label>
    <span className="selector-divider"><Icon name="chevron" size={16} /></span>
    <label className="curriculum-field is-locked">
      <span>单元</span>
      <select value="geometry-perimeter" disabled aria-label="单元">
        <option value="geometry-perimeter">图形与几何 · 周长</option>
      </select>
      <small><Icon name="lock" size={12} /> V1开放</small>
    </label>
    <span className="selector-divider"><Icon name="chevron" size={16} /></span>
    <label className="curriculum-field">
      <span>知识点</span>
      <select value={knowledge} onChange={(event) => setKnowledge(event.target.value)} aria-label="知识点">
        {KNOWLEDGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <small className="is-ready">● 可切换</small>
    </label>
  </div>
);

const Sidebar = ({ activeView, setActiveView }) => {
  const activeIndex = WORKFLOW.findIndex((item) => item.id === activeView);

  return (
    <aside className="math-sidebar">
    <a className="assistant-brand" href="/" aria-label="返回上节好课首页">
      <span className="brand-mark"><span>π</span></span>
      <span className="brand-copy">
        <strong>上节好课</strong>
        <small>AI 精准教学</small>
      </span>
    </a>

    <div className="workflow-label">三阶六步</div>
    <nav className="workflow-nav" aria-label="教学流程">
      {WORKFLOW.map((item, index) => (
        <button
          key={item.id}
          className={`workflow-item ${activeView === item.id ? 'is-active' : ''}`}
          onClick={() => setActiveView(item.id)}
        >
          <span className="workflow-number">{item.number}</span>
          <span className="workflow-copy">
            <strong>{item.stage}</strong>
            <small>{item.caption}</small>
          </span>
          <span className="workflow-state">
            {activeView === item.id ? '当前' : index < activeIndex ? '已完成' : '待开始'}
          </span>
        </button>
      ))}
    </nav>

    <div className="sidebar-note">
      <Icon name="shield" size={18} />
      <div>
        <strong>教师始终拥有判断权</strong>
        <p>AI建议仅作辅助，所有诊断均需教师确认。</p>
      </div>
    </div>

    <a className="back-home" href="/works.html"><Icon name="home" size={17} /> 返回作品集</a>
    </aside>
  );
};

const WorksheetPreview = ({ uploadedImage }) => (
  <div className="worksheet-frame">
    {uploadedImage ? (
      <img src={uploadedImage} alt="已上传的学生作品预览" />
    ) : (
      <div className="mock-worksheet">
        <div className="worksheet-meta"><span>三年级数学随堂练习</span><span>学生 07</span></div>
        <div className="worksheet-rule" />
        <p className="question-no">3. 给下面的长方形花圃围一圈篱笆，需要多少米？</p>
        <div className="rectangle-sketch">
          <span className="side-top">8米</span>
          <span className="side-right">5米</span>
        </div>
        <div className="student-answer">
          <span>8 + 5 = 13（米）</span>
          <span className="teacher-mark">？</span>
        </div>
      </div>
    )}
    <span className="evidence-chip"><Icon name="file" size={13} /> 学习证据 01</span>
  </div>
);

const DiagnosisView = ({
  knowledge,
  onContinue,
  onAuthExpired,
  classes,
  selectedClassId,
  selectedStudentId,
  onClassChange,
  onStudentChange,
  rosterStatus,
  onManageRoster,
  onAnalysisStarted,
}) => {
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(DEMO_DIAGNOSIS);
  const [cause, setCause] = useState(DEMO_DIAGNOSIS.possibleCause);
  const [analysisStatus, setAnalysisStatus] = useState('demo');
  const [analysisError, setAnalysisError] = useState('');
  const [diagnosisId, setDiagnosisId] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState('idle');
  const [layeringStatus, setLayeringStatus] = useState('idle');
  const selectedClass = classes.find((item) => item.id === selectedClassId);
  const selectedStudent = selectedClass?.students.find((item) => item.id === selectedStudentId);

  useEffect(() => () => abortRef.current?.abort(), []);

  const analyzeFile = async (file) => {
    onAnalysisStarted();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalysisStatus('loading');
    setAnalysisError('');
    setConfirmed(false);
    setDiagnosisId('');
    setConfirmationStatus('idle');
    setLayeringStatus('idle');
    setIsEditing(false);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('knowledgePoint', knowledge);
      formData.append('classId', selectedClassId);
      formData.append('studentId', selectedStudentId);
      formData.append('studentCode', selectedStudent?.anonymousCode || '');
      const response = await apiFetch('/api/diagnoses/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效，请重新登录');
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || 'AI分析失败，请稍后重试');
      }

      setDiagnosis(payload.diagnosis);
      setCause(payload.diagnosis.possibleCause);
      setDiagnosisId(payload.meta?.diagnosisId || '');
      setAnalysisStatus('ready');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setAnalysisStatus('error');
      setAnalysisError(error.message || 'AI分析失败，请稍后重试');
    }
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedClassId || !selectedStudentId) {
      setAnalysisStatus('error');
      setAnalysisError('请先选择班级和学生；如果还没有名单，请点击“管理班级”添加');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAnalysisStatus('error');
      setAnalysisError('图片不能超过5MB，请压缩后重新上传');
      event.target.value = '';
      return;
    }

    if (uploadedImage) URL.revokeObjectURL(uploadedImage);
    setUploadedImage(URL.createObjectURL(file));
    analyzeFile(file);
    event.target.value = '';
  };

  const confidenceLabel = `${Math.round((diagnosis.confidence || 0) * 100)}%`;
  const isReady = analysisStatus === 'ready';

  const handleConfirmation = async () => {
    if (!diagnosisId || confirmationStatus === 'loading') return;
    const nextStatus = confirmed ? 'pending' : 'confirmed';
    setConfirmationStatus('loading');
    setAnalysisError('');
    try {
      const response = await apiFetch(`/api/diagnoses/${encodeURIComponent(diagnosisId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, possibleCause: cause }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效，请重新登录');
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '诊断保存失败');
      setConfirmed(nextStatus === 'confirmed');
      setConfirmationStatus('idle');
    } catch (confirmationError) {
      setConfirmationStatus('error');
      setAnalysisError(confirmationError.message || '诊断保存失败，请稍后重试');
    }
  };

  const handleGenerateProfile = async () => {
    if (!confirmed || !diagnosisId || layeringStatus === 'loading') return;
    setLayeringStatus('loading');
    setAnalysisError('');
    try {
      const response = await apiFetch(`/api/diagnoses/${encodeURIComponent(diagnosisId)}/layering`, {
        method: 'POST',
      });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效，请重新登录');
      }
      if (!response.ok || !payload.ok || !payload.profile) {
        throw new Error(payload.error?.message || '学习画像生成失败');
      }
      setLayeringStatus('ready');
      onContinue(payload.profile);
    } catch (profileError) {
      setLayeringStatus('error');
      setAnalysisError(profileError.message || '学习画像生成失败，请稍后重试');
    }
  };

  return (
    <section className="view-panel diagnosis-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Icon name="spark" size={15} /> 第一阶 · 智能诊断</span>
          <h2>看见错误背后的思考</h2>
          <p>上传学生作品，由 AI 提取学习证据；教师确认后形成可信诊断。</p>
        </div>
        <div className="student-selection">
          <label><span>班级</span><select value={selectedClassId} onChange={(event) => onClassChange(event.target.value)} disabled={analysisStatus === 'loading' || rosterStatus === 'loading'} aria-label="选择班级">
            {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select></label>
          <label><span>匿名学生编号</span><select value={selectedStudentId} onChange={(event) => onStudentChange(event.target.value)} disabled={analysisStatus === 'loading' || !selectedClass?.students.length} aria-label="选择学生">
            {!selectedClass?.students.length && <option value="">暂无学生</option>}
            {selectedClass?.students.map((item) => <option key={item.id} value={item.id}>{item.anonymousCode}</option>)}
          </select></label>
          <button onClick={onManageRoster}><Icon name="users" size={15} /> 管理班级</button>
        </div>
      </div>

      <div className="diagnosis-grid">
        <article className="workspace-card evidence-card">
          <div className="card-title-row">
            <div>
              <span className="step-kicker">01 / 多源采集</span>
              <h3>学生作品</h3>
            </div>
            <button className="text-button" onClick={() => inputRef.current?.click()} disabled={analysisStatus === 'loading'}><Icon name="upload" size={16} /> 更换作品</button>
          </div>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
          <WorksheetPreview uploadedImage={uploadedImage} />
          <button className="upload-dropzone" onClick={() => inputRef.current?.click()} disabled={analysisStatus === 'loading'}>
            <span className="upload-icon"><Icon name="upload" size={20} /></span>
            <span><strong>{analysisStatus === 'loading' ? 'GLM 正在分析作品…' : '点击上传新作品'}</strong><small>支持 JPG、PNG、WEBP · 最大5MB · 请隐去学生姓名</small></span>
          </button>
        </article>

        <article className="workspace-card analysis-card">
          <div className="card-title-row">
            <div>
              <span className="step-kicker">02 / 人机析因</span>
              <h3>AI 初步诊断</h3>
            </div>
            <span className={`ai-badge ${isReady ? 'is-live' : ''}`}><Icon name="spark" size={14} /> {isReady ? 'GLM 实时结果' : 'AI 建议'}</span>
          </div>

          <div className={`recognition-block ${analysisStatus === 'loading' ? 'is-loading' : ''}`}>
            <span className="block-label">识别到的作答</span>
            <div className="math-expression">
              <span>{analysisStatus === 'loading' ? '正在识别图片内容…' : diagnosis.recognizedAnswer}</span>
              <small>{isReady ? `置信度 ${confidenceLabel}` : '上传后实时分析'}</small>
            </div>
            {isReady && <p className="expected-answer">参考答案：{diagnosis.expectedAnswer}</p>}
          </div>

          {analysisStatus === 'error' && (
            <div className="analysis-notice is-error"><Icon name="info" size={15} /><span>{analysisError}</span></div>
          )}
          {isReady && diagnosis.warnings?.length > 0 && (
            <div className="analysis-notice"><Icon name="info" size={15} /><span>{diagnosis.warnings.join('；')}</span></div>
          )}

          <div className="diagnosis-list">
            <div className="diagnosis-row">
              <span className="diagnosis-icon is-coral">错</span>
              <div><small>错误类型</small><strong>{analysisStatus === 'loading' ? '等待AI判断' : diagnosis.errorType}</strong></div>
            </div>
            <div className="diagnosis-row align-start">
              <span className="diagnosis-icon is-gold">因</span>
              <div className="editable-cause">
                <small>可能原因</small>
                {isEditing ? (
                  <textarea value={cause} onChange={(event) => setCause(event.target.value)} autoFocus />
                ) : <strong>{cause}</strong>}
              </div>
              <button className="icon-button" onClick={() => setIsEditing(!isEditing)} aria-label="修改可能原因"><Icon name={isEditing ? 'check' : 'edit'} size={16} /></button>
            </div>
            <div className="diagnosis-row">
              <span className="diagnosis-icon is-green">需</span>
              <div><small>学习需求</small><strong>{analysisStatus === 'loading' ? '分析完成后生成' : diagnosis.learningNeed}</strong></div>
            </div>
          </div>

          <div className={`teacher-confirm ${confirmed ? 'is-confirmed' : ''}`}>
            <div>
              <span className="confirm-check"><Icon name="check" size={15} /></span>
              <span><strong>{confirmed ? '教师已确认并保存' : (isReady ? 'AI草稿已保存，等待教师判断' : '请先上传学生作品')}</strong><small>{confirmed ? '教师修改已写入诊断历史记录' : (isReady ? '确认后才会生成学生画像和分层任务' : 'AI完成分析后才可确认')}</small></span>
            </div>
            <button onClick={handleConfirmation} disabled={!isReady || !diagnosisId || confirmationStatus === 'loading'}>{confirmationStatus === 'loading' ? '保存中…' : (confirmed ? '撤回确认' : '确认诊断')}</button>
          </div>
        </article>
      </div>

      <div className="view-action-row">
        <div className="privacy-tip"><Icon name="shield" size={16} /> 图片只用于本次AI分析，Worker不留存原图；请先隐去学生姓名。</div>
        <button className="primary-action" onClick={handleGenerateProfile} disabled={!confirmed || layeringStatus === 'loading'}>{layeringStatus === 'loading' ? 'GLM 正在生成画像…' : '生成学习画像'} {layeringStatus !== 'loading' && <Icon name="arrow" size={18} />}</button>
      </div>
    </section>
  );
};

const LayeringView = ({ profile, onBack, onContinue }) => {
  const layerMeta = {
    support: { index: '01', title: '基础理解', tone: 'mint', label: '看懂概念，修正直接错因' },
    consolidation: { index: '02', title: '巩固应用', tone: 'gold', label: '运用方法，讲清计算道理' },
    exploration: { index: '03', title: '迁移探究', tone: 'coral', label: '进入变式，检验真正理解' },
  };

  if (!profile) {
    return (
      <section className="view-panel layering-view">
        <div className="layering-empty">
          <span><Icon name="layers" size={26} /></span>
          <h2>还没有可用的学习画像</h2>
          <p>请先上传学生作品、确认 AI 诊断，再生成真实的分层任务。</p>
          <button onClick={onBack}>返回智能诊断</button>
        </div>
      </section>
    );
  }

  const suggestedLayer = layerMeta[profile.currentLayer]?.title || '巩固应用';
  const knowledgeLabel = KNOWLEDGE_OPTIONS.find((item) => item.value === profile.knowledgePoint)?.label || profile.knowledgePoint;

  return (
    <section className="view-panel layering-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Icon name="layers" size={15} /> 第二阶 · 动态分层</span>
          <h2>让每个孩子，从合适的台阶出发</h2>
          <p>画像不是固定标签，而是基于本次学习证据生成的动态起点。</p>
        </div>
        <span className="case-pill"><Icon name="spark" size={15} /> 基于诊断生成</span>
      </div>

      <div className="layering-step-grid">
        <article className="workspace-card portrait-card">
          <div className="card-title-row">
            <div>
              <span className="step-kicker">03 / 画像分层</span>
              <h3>学生学习画像</h3>
            </div>
            <span className="ai-badge is-live"><Icon name="spark" size={14} /> 本次证据</span>
          </div>

          <div className="portrait-student">
            <div className="student-avatar">{profile.studentCode?.slice(0, 2) || '生'}</div>
            <div>
              <span>当前分析对象</span>
              <strong>{profile.className} · 学生 {profile.studentCode}</strong>
              <small>{knowledgeLabel}</small>
            </div>
          </div>

          <div className="portrait-points">
            <div className="portrait-point is-strength">
              <span className="portrait-symbol">优</span>
              <div><small>已有基础</small><strong>{profile.strengths}</strong></div>
            </div>
            <div className="portrait-point is-challenge">
              <span className="portrait-symbol">难</span>
              <div><small>当前困难</small><strong>{profile.challenges}</strong></div>
            </div>
            <div className="portrait-point is-need">
              <span className="portrait-symbol">需</span>
              <div><small>核心学习需求</small><strong>{profile.learningNeeds}</strong></div>
            </div>
          </div>

          <div className="portrait-layer-summary">
            <div><span>AI 建议层级</span><strong>{suggestedLayer}</strong></div>
            <p><Icon name="history" size={14} /> 画像只代表本次学习起点；有新的诊断证据后会重新生成。</p>
          </div>
        </article>

        <article className="workspace-card intervention-card">
          <div className="card-title-row">
            <div>
              <span className="step-kicker">04 / 精准干预</span>
              <h3>分层阶梯式题目</h3>
            </div>
            <span className="growth-badge">按顺序完成</span>
          </div>

          <div className="intervention-intro">
            <span>AI制定依据</span>
            <strong>{profile.errorType || '本次错因'}＋学生画像</strong>
            <small>不是三选一：三个台阶前后衔接，由浅入深依次学习。</small>
          </div>

          <div className="intervention-ladder">
            {(profile.tasks || []).map((task, index) => {
              const meta = layerMeta[task.layer] || layerMeta.consolidation;
              return (
                <div key={task.id || task.layer} className={`intervention-step tone-${meta.tone}`}>
                  <span className="layer-index">{meta.index}</span>
                  <span className="intervention-copy">
                    <span className="layer-label">第 {index + 1} 阶 · {meta.title}</span>
                    <strong>{task.title}</strong>
                    <span className="task-description">{task.taskContent}</span>
                    <span className="task-meta"><b>学习目标</b>{task.taskGoal || meta.label}<i>约 {task.estimatedMinutes || 12} 分钟</i></span>
                  </span>
                  <span className="step-complete-mark"><Icon name="check" size={16} /></span>
                  {index < (profile.tasks || []).length - 1 && <span className="ladder-connector"><Icon name="arrow" size={17} /></span>}
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="view-action-row">
        <div className="privacy-tip"><Icon name="info" size={16} /> 教师可直接使用这组阶梯题，也可以据此自行调整或出题。</div>
        <button className="primary-action" onClick={onContinue}>完成干预，上传后测作品 <Icon name="arrow" size={18} /></button>
      </div>
    </section>
  );
};

const EvaluationView = ({ profile, onAuthExpired, onBack }) => {
  const inputRef = useRef(null);
  const [postImage, setPostImage] = useState('');
  const [taskSource, setTaskSource] = useState('ai_ladder');
  const [evaluation, setEvaluation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!profile) return undefined;
    const controller = new AbortController();
    setStatus('loading');
    apiFetch(`/api/profiles/${encodeURIComponent(profile.id)}/evaluation`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (response.status === 401) {
          onAuthExpired();
          return;
        }
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '评价记录读取失败');
        if (payload.evaluation?.postTest) {
          setEvaluation(payload.evaluation);
          setTaskSource(payload.evaluation.taskSource || 'ai_ladder');
          setMessage('已读取AI生成的前后测反馈');
        }
        setStatus('idle');
      })
      .catch((loadError) => {
        if (loadError.name === 'AbortError') return;
        setStatus('error');
        setMessage(loadError.message || '评价记录读取失败');
      });
    return () => controller.abort();
  }, [profile, onAuthExpired]);

  if (!profile) {
    return (
      <section className="view-panel evaluation-view"><div className="layering-empty"><span><Icon name="chart" size={26} /></span><h2>还没有可评价的学习任务</h2><p>请先完成诊断和分层任务，再记录前后测变化。</p><button onClick={onBack}>返回智能诊断</button></div></section>
    );
  }

  const handlePostFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || status === 'analyzing') return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus('error');
      setMessage('图片不能超过5MB，请压缩后重新上传');
      return;
    }
    if (postImage) URL.revokeObjectURL(postImage);
    setPostImage(URL.createObjectURL(file));
    setStatus('analyzing');
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('taskSource', taskSource);
      const response = await apiFetch(`/api/profiles/${encodeURIComponent(profile.id)}/evaluation/analyze`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效，请重新登录');
      }
      if (!response.ok || !payload.ok || !payload.evaluation) throw new Error(payload.error?.message || '后测作品分析失败');
      setEvaluation(payload.evaluation);
      setStatus('ready');
      setMessage('AI已完成前测与后测证据对比，结果已保存');
    } catch (analysisError) {
      setStatus('error');
      setMessage(analysisError.message || '后测作品分析失败，请稍后重试');
    }
  };

  const comparison = evaluation?.comparison || {};
  const postTest = evaluation?.postTest;

  return (
    <section className="view-panel evaluation-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Icon name="chart" size={15} /> 第三阶 · 多元评价</span>
          <h2>用第二份作品，看见真实变化</h2>
          <p>上传学生后测作品，AI对比前测诊断与后测证据，形成下一轮教学反馈。</p>
        </div>
        <span className="case-pill"><Icon name="spark" size={15} /> AI前后测对比</span>
      </div>

      <div className="evaluation-grid">
        <article className="workspace-card post-test-card">
          <div className="card-title-row">
            <div><span className="step-kicker">05 / 多维评学</span><h3>上传后测作品</h3></div>
            <span className="growth-badge">第二份学习证据</span>
          </div>

          <div className="task-source-field">
            <span>后测题目来源</span>
            <div>
              <button className={taskSource === 'ai_ladder' ? 'is-active' : ''} onClick={() => setTaskSource('ai_ladder')} disabled={status === 'analyzing'}><Icon name="layers" size={16} /> 使用第4步阶梯题</button>
              <button className={taskSource === 'teacher_authored' ? 'is-active' : ''} onClick={() => setTaskSource('teacher_authored')} disabled={status === 'analyzing'}><Icon name="edit" size={16} /> 教师自拟题</button>
            </div>
            <small>两种方式都可以，AI会结合第一次上传的诊断证据进行比较。</small>
          </div>

          <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePostFile} />
          <button className={`post-test-upload ${postImage ? 'has-image' : ''}`} onClick={() => inputRef.current?.click()} disabled={status === 'analyzing'}>
            {postImage ? <img src={postImage} alt="学生后测作品预览" /> : <span className="post-upload-icon"><Icon name="upload" size={25} /></span>}
            <span className="post-upload-copy">
              <strong>{status === 'analyzing' ? 'GLM正在分析后测作品…' : (postImage ? '点击更换后测作品' : '点击上传学生后测作品')}</strong>
              <small>支持 JPG、PNG、WEBP · 最大5MB · 请隐去学生姓名</small>
            </span>
          </button>

          {postTest && (
            <div className="post-recognition">
              <span>AI识别到的后测作答</span>
              <strong>{postTest.recognizedAnswer}</strong>
              <small>参考答案：{postTest.expectedAnswer} · 置信度 {Math.round((postTest.confidence || 0) * 100)}%</small>
            </div>
          )}
        </article>

        <article className="workspace-card feedback-card ai-feedback-card">
          <div className="card-title-row"><div><span className="step-kicker">06 / 反馈迭代</span><h3>AI最终反馈</h3></div><span className="ai-badge is-live"><Icon name="spark" size={14} /> 两次作品对比</span></div>

          {!evaluation && status !== 'analyzing' && (
            <div className="feedback-waiting"><span><Icon name="chart" size={25} /></span><strong>等待后测作品</strong><p>上传后，AI将自动比较前测错因、学习画像和后测表现。</p></div>
          )}
          {status === 'analyzing' && (
            <div className="feedback-waiting is-analyzing"><span><Icon name="spark" size={25} /></span><strong>正在形成反馈</strong><p>AI正在识别后测，并对比两次学习证据，请稍候。</p></div>
          )}
          {evaluation && status !== 'analyzing' && (
            <div className="ai-feedback-content">
              <div className="change-analysis">
                <span className="feedback-block-title">变化分析</span>
                <div><small>概念理解</small><strong>{comparison.conceptChange || '证据不足'}</strong></div>
                <div><small>方法与算理</small><strong>{comparison.methodChange || '证据不足'}</strong></div>
                <div><small>变式迁移</small><strong>{comparison.transferChange || '证据不足'}</strong></div>
              </div>
              <div className="feedback-section is-solved"><span className="feedback-symbol"><Icon name="check" size={15} /></span><div><small>已经解决或明显改善</small><strong>{comparison.solvedSummary || '暂未发现足够证据'}</strong></div></div>
              <div className="feedback-section is-pending"><span className="feedback-symbol">!</span><div><small>仍需关注</small><strong>{comparison.remainingSummary || '需要教师继续观察'}</strong></div></div>
              <div className="next-step-note"><span>下一轮教学建议</span><ol>{(comparison.teachingSuggestions || []).map((item) => <li key={item}>{item}</li>)}</ol></div>
            </div>
          )}
        </article>
      </div>

      <div className="view-action-row">
        <div className={`privacy-tip ${status === 'error' ? 'is-error' : ''}`}><Icon name={evaluation ? 'check' : 'info'} size={16} /> {message || `${profile.className} · 学生 ${profile.studentCode} · 原始后测图片不长期保存`}</div>
        {evaluation && <button className="primary-action" onClick={() => inputRef.current?.click()} disabled={status === 'analyzing'}>重新上传后测 <Icon name="upload" size={18} /></button>}
      </div>
    </section>
  );
};

const AIMathAssistantPage = () => {
  const [activeView, setActiveView] = useState('diagnosis');
  const [knowledge, setKnowledge] = useState('rectangle');
  const [authStatus, setAuthStatus] = useState('checking');
  const [teacher, setTeacher] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [classManagerOpen, setClassManagerOpen] = useState(false);
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rosterStatus, setRosterStatus] = useState('idle');
  const [layeringProfile, setLayeringProfile] = useState(null);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeView]);

  const handleAuthExpired = useCallback(() => {
    setTeacher(null);
    setHistoryOpen(false);
    setClassManagerOpen(false);
    setClasses([]);
    setLayeringProfile(null);
    setAuthStatus('anonymous');
  }, []);

  const loadClasses = useCallback(async () => {
    setRosterStatus('loading');
    try {
      const response = await apiFetch('/api/classes');
      if (response.status === 401) {
        handleAuthExpired();
        return;
      }
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '班级名单加载失败');
      setClasses(payload.classes || []);
      setRosterStatus('ready');
    } catch {
      setRosterStatus('error');
    }
  }, [handleAuthExpired]);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          handleAuthExpired();
          return;
        }
        const payload = await response.json();
        setTeacher(payload.teacher);
        setAuthStatus('authenticated');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') handleAuthExpired();
      });
    return () => controller.abort();
  }, [handleAuthExpired]);

  useEffect(() => {
    if (authStatus === 'authenticated') loadClasses();
  }, [authStatus, loadClasses]);

  useEffect(() => {
    if (!classes.length) {
      setSelectedClassId('');
      setSelectedStudentId('');
      return;
    }
    const nextClass = classes.find((item) => item.id === selectedClassId) || classes[0];
    if (nextClass.id !== selectedClassId) setSelectedClassId(nextClass.id);
    setSelectedStudentId((current) => (
      nextClass.students.some((student) => student.id === current)
        ? current
        : nextClass.students[0]?.id || ''
    ));
  }, [classes, selectedClassId]);

  const handleClassChange = (classId) => {
    const nextClass = classes.find((item) => item.id === classId);
    setSelectedClassId(classId);
    setSelectedStudentId(nextClass?.students[0]?.id || '');
    setLayeringProfile(null);
  };

  const handleStudentChange = (studentId) => {
    setSelectedStudentId(studentId);
    setLayeringProfile(null);
  };

  const handleLogin = (loggedInTeacher) => {
    setTeacher(loggedInTeacher);
    setAuthStatus('authenticated');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      handleAuthExpired();
    }
  };

  if (authStatus === 'checking') {
    return <main className="auth-loading"><span className="brand-mark"><span>π</span></span><strong>正在进入教师工作台…</strong></main>;
  }

  if (authStatus !== 'authenticated' || !teacher) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="ai-math-app">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="assistant-main">
        <header className="assistant-topbar">
          <div className="mobile-brand"><span className="brand-mark"><span>π</span></span><strong>AI 精准教学</strong></div>
          <CurriculumSelector knowledge={knowledge} setKnowledge={setKnowledge} />
          <div className="teacher-profile">
            <span className="teacher-avatar">{teacher.displayName?.slice(0, 1) || '师'}</span>
            <span><strong>{teacher.displayName}</strong><small>三年级数学</small></span>
            <button onClick={() => setClassManagerOpen(true)} title="班级与学生" aria-label="打开班级与学生管理"><Icon name="users" size={17} /></button>
            <button onClick={() => setHistoryOpen(true)} title="诊断记录" aria-label="打开诊断记录"><Icon name="history" size={17} /></button>
            <button onClick={handleLogout} title="退出登录" aria-label="退出登录"><Icon name="logout" size={17} /></button>
          </div>
        </header>

        <div className="assistant-content">
          <div className="prototype-banner"><span>GLM 联调版</span><p>已接入 GLM-4.6V-FlashX；AI诊断仅作建议，须由教师确认。</p></div>
          {activeView === 'diagnosis' && (
            <DiagnosisView
              knowledge={knowledge}
              onContinue={(profile) => { setLayeringProfile(profile); setActiveView('layering'); }}
              onAuthExpired={handleAuthExpired}
              classes={classes}
              selectedClassId={selectedClassId}
              selectedStudentId={selectedStudentId}
              onClassChange={handleClassChange}
              onStudentChange={handleStudentChange}
              rosterStatus={rosterStatus}
              onManageRoster={() => setClassManagerOpen(true)}
              onAnalysisStarted={() => setLayeringProfile(null)}
            />
          )}
          {activeView === 'layering' && (
            <LayeringView
              key={layeringProfile?.id || 'empty-layering'}
              profile={layeringProfile}
              onProfileChange={setLayeringProfile}
              onAuthExpired={handleAuthExpired}
              onBack={() => setActiveView('diagnosis')}
              onContinue={() => setActiveView('evaluation')}
            />
          )}
          {activeView === 'evaluation' && <EvaluationView profile={layeringProfile} onAuthExpired={handleAuthExpired} onBack={() => setActiveView('diagnosis')} />}
        </div>
      </main>
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onAuthExpired={handleAuthExpired}
        onOpenProfile={(profile) => { setLayeringProfile(profile); setHistoryOpen(false); setActiveView('layering'); }}
      />
      <ClassManagerDrawer
        open={classManagerOpen}
        onClose={() => setClassManagerOpen(false)}
        classes={classes}
        selectedClassId={selectedClassId}
        onSelectClass={handleClassChange}
        onRefresh={loadClasses}
        onAuthExpired={handleAuthExpired}
      />
    </div>
  );
};

export default AIMathAssistantPage;
